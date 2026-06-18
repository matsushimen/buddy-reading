#!/usr/bin/env node

const port = process.env.CHROME_DEBUG_PORT ?? "9225";
const baseUrl = `http://127.0.0.1:${port}`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "list") {
    const tabs = await fetchJson(`${baseUrl}/json/list`);
    const pages = tabs
      .filter((tab) => typeof tab.webSocketDebuggerUrl === "string" && tab.type === "page")
      .map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url
      }));
    console.log(JSON.stringify(pages, null, 2));
    return;
  }

  if (command === "eval") {
    const [matcher, ...expressionParts] = rest;
    const expression = expressionParts.join(" ").trim();
    if (!matcher || !expression) {
      throw new Error("Usage: node scripts/chrome-cdp.mjs eval <url-substring> <expression>");
    }

    const tab = await findTab(matcher);
    const client = await createClient(tab.webSocketDebuggerUrl);
    try {
      await client.send("Runtime.enable");
      const result = await client.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      console.log(JSON.stringify(result.result?.value ?? null, null, 2));
    } finally {
      client.close();
    }
    return;
  }

  throw new Error("Usage: node scripts/chrome-cdp.mjs <list|eval> [...]");
}

async function findTab(matcher) {
  const tabs = await fetchJson(`${baseUrl}/json/list`);
  const tab = tabs.find(
    (entry) =>
      entry.type === "page" &&
      typeof entry.webSocketDebuggerUrl === "string" &&
      (entry.url.includes(matcher) || entry.title.includes(matcher))
  );

  if (!tab) {
    throw new Error(`No Chrome tab matched: ${matcher}`);
  }

  return tab;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CDP HTTP error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function createClient(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (typeof message.id !== "number") {
      return;
    }

    const deferred = pending.get(message.id);
    if (!deferred) {
      return;
    }

    pending.delete(message.id);
    if (message.error) {
      deferred.reject(new Error(message.error.message));
      return;
    }

    deferred.resolve(message.result);
  });

  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
