package com.melyap.flashcards;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Hotspot play: newline-delimited JSON over plain TCP. The host phone listens on PORT and gives each
 * guest a connection id from 1 up; a guest's own link to the host has id 0. Plain sockets avoid the
 * WebView's limits on unencrypted connections from the https app origin.
 */
@CapacitorPlugin(name = "Lan")
public class LanPlugin extends Plugin {
    private static final int PORT = 8737;
    private static final int CONNECT_TIMEOUT_MS = 5000;

    private final ExecutorService readers = Executors.newCachedThreadPool();
    /** One writer thread keeps each connection's messages in order. */
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private final Map<Integer, Socket> peers = new ConcurrentHashMap<>();
    private final AtomicInteger nextId = new AtomicInteger(1);
    private volatile ServerSocket server;

    @PluginMethod
    public void host(PluginCall call) {
        stopAll();
        try {
            ServerSocket s = new ServerSocket();
            s.setReuseAddress(true);
            s.bind(new InetSocketAddress(PORT));
            server = s;
            readers.execute(() -> acceptLoop(s));
        } catch (IOException e) {
            call.reject("Couldn't start the game: " + e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("addresses", new JSArray(localAddresses()));
        ret.put("port", PORT);
        call.resolve(ret);
    }

    @PluginMethod
    public void join(PluginCall call) {
        String address = call.getString("address", "").trim();
        if (address.isEmpty()) {
            call.reject("Enter the host's address.");
            return;
        }
        stopAll();
        readers.execute(() -> {
            Socket socket = new Socket();
            try {
                socket.connect(new InetSocketAddress(address, PORT), CONNECT_TIMEOUT_MS);
                socket.setTcpNoDelay(true);
            } catch (IOException | IllegalArgumentException e) {
                closeQuietly(socket);
                call.reject("Couldn't reach " + address + ". Check that this phone is on the host's hotspot.");
                return;
            }
            peers.put(0, socket);
            call.resolve();
            readLoop(0, socket);
        });
    }

    @PluginMethod
    public void send(PluginCall call) {
        Integer to = call.getInt("to");
        String data = call.getString("data");
        Socket socket = to == null ? null : peers.get(to);
        if (socket != null && data != null) {
            int id = to;
            writer.execute(() -> write(id, socket, data));
        }
        call.resolve();
    }

    @PluginMethod
    public void broadcast(PluginCall call) {
        String data = call.getString("data");
        if (data != null) {
            for (Map.Entry<Integer, Socket> e : peers.entrySet()) {
                int id = e.getKey();
                Socket socket = e.getValue();
                if (id != 0) writer.execute(() -> write(id, socket, data));
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void close(PluginCall call) {
        stopAll();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopAll();
        readers.shutdownNow();
        writer.shutdownNow();
    }

    private void acceptLoop(ServerSocket s) {
        while (!s.isClosed()) {
            try {
                Socket socket = s.accept();
                socket.setTcpNoDelay(true);
                int id = nextId.getAndIncrement();
                peers.put(id, socket);
                emitPeer(id, true);
                readers.execute(() -> readLoop(id, socket));
            } catch (IOException e) {
                return;
            }
        }
    }

    private void readLoop(int id, Socket socket) {
        try {
            BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
            String line;
            while ((line = in.readLine()) != null) {
                JSObject ev = new JSObject();
                ev.put("from", id);
                ev.put("data", line);
                notifyListeners("message", ev);
            }
        } catch (IOException ignored) {
            // The connection closed.
        }
        drop(id, socket);
    }

    private void write(int id, Socket socket, String data) {
        try {
            OutputStream out = socket.getOutputStream();
            out.write((data + "\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
        } catch (IOException e) {
            drop(id, socket);
        }
    }

    /** Reports a lost connection once. Connections closed by stopAll are already gone and stay quiet. */
    private void drop(int id, Socket socket) {
        if (peers.remove(id, socket)) {
            closeQuietly(socket);
            emitPeer(id, false);
        }
    }

    private void emitPeer(int id, boolean joined) {
        JSObject ev = new JSObject();
        ev.put("id", id);
        ev.put("joined", joined);
        notifyListeners("peer", ev);
    }

    private void stopAll() {
        ServerSocket s = server;
        server = null;
        if (s != null) {
            try {
                s.close();
            } catch (IOException ignored) {
                // Already closed.
            }
        }
        List<Socket> open = new ArrayList<>(peers.values());
        peers.clear();
        for (Socket socket : open) closeQuietly(socket);
    }

    private static void closeQuietly(Socket socket) {
        try {
            socket.close();
        } catch (IOException ignored) {
            // Already closed.
        }
    }

    /** Private IPv4 addresses, the hotspot interface first; mobile data and VPN interfaces are left out. */
    private static List<String> localAddresses() {
        List<String> hotspot = new ArrayList<>();
        List<String> other = new ArrayList<>();
        try {
            for (NetworkInterface nif : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!nif.isUp() || nif.isLoopback()) continue;
                String name = nif.getName().toLowerCase();
                if (name.startsWith("rmnet") || name.startsWith("ccmni") || name.startsWith("dummy") || name.startsWith("tun")) continue;
                boolean ap = name.startsWith("ap") || name.contains("swlan") || name.contains("softap");
                for (InetAddress addr : Collections.list(nif.getInetAddresses())) {
                    if (addr instanceof Inet4Address && addr.isSiteLocalAddress()) {
                        (ap ? hotspot : other).add(addr.getHostAddress());
                    }
                }
            }
        } catch (Exception ignored) {
            // No addresses to show; the lobby says so.
        }
        hotspot.addAll(other);
        return hotspot;
    }
}
