import {defineConfig} from 'vite';
import inarisk from './api/inarisk.js';
const proxy=server=>{server.middlewares.use('/api/inarisk',(req,res)=>{inarisk(req,res);});};
export default defineConfig({plugins:[{name:'inarisk-official-proxy',configureServer:proxy,configurePreviewServer:proxy}]});
