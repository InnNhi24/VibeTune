import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
  if (!apiKey) return new Response("Missing DEEPGRAM_API_KEY", { status: 500 });

  // Proxy upgrade
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") return new Response("Upgrade required", { status: 426 });

  // Connect to Deepgram websocket endpoint
  const dgUrl = "wss://api.deepgram.com/v1/listen?model=nova-2-general";
  const dgReq = await fetch(dgUrl, {
    method: "GET",
    headers: { Authorization: `Token ${apiKey}` },
  });

  const dsSocket = (dgReq as any).webSocket;
  if (!dsSocket) return new Response("Failed to connect Deepgram", { status: 502 });

  const { socket, response } = Deno.upgradeWebSocket(req);

  // pipe client -> deepgram
  socket.onmessage = (e) => {
    try { dsSocket.send(e.data); } catch (err) { console.warn('dg send', err); }
  };
  // pipe deepgram -> client
  dsSocket.onmessage = (e) => {
    try { socket.send(e.data); } catch (err) { console.warn('client send', err); }
  };

  dsSocket.onclose = () => socket.close();
  socket.onclose = () => dsSocket.close();

  return response;
});
