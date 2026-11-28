import http from 'node:http';
import tls from 'node:tls';
import {defineConfig} from 'vite';
import news from './api/news.js';
import inarisk from './api/inarisk.js';
import slope from './api/slope.js';
import bmkgAlerts from './api/bmkg-alerts.js';
import webgisSummary from './api/webgis-summary.js';
// The Cloud workspace routes outbound HTTPS through its configured proxy.
if (process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy) {
 http.setGlobalProxyFromEnv?.();
 if (tls.setDefaultCACertificates) {
  tls.setDefaultCACertificates([...new Set([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])]);
 }
}
const monitoringRoute = handler => async (req,res,next) => {
 res.status = code => { res.statusCode = code; return res; };
 res.json = data => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); };
 try {await handler(req,res);} catch (error) {next(error);}
};
const proxy=server=>{server.middlewares.use('/api/webgis-summary',monitoringRoute(webgisSummary));server.middlewares.use('/api/bmkg-alerts',monitoringRoute(bmkgAlerts));server.middlewares.use('/api/news',(req,res)=>{news(req,res);});server.middlewares.use('/api/inarisk',(req,res)=>{inarisk(req,res);});server.middlewares.use('/api/slope',(req,res)=>{slope(req,res);});};
export default defineConfig({plugins:[{name:'inarisk-official-proxy',configureServer:proxy,configurePreviewServer:proxy}]});
