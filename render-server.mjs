import http from 'node:http';
import worker from './worker/index.js';

const port = Number(process.env.PORT || 10000);
const host = '0.0.0.0';
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const request = new Request(url, { method: req.method });
    const response = await worker.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Request failed:', error);
    res.statusCode = 500;
    res.end('Internal server error');
  }
});
server.listen(port, host, () => console.log(`Drum Highway listening on ${host}:${port}`));
