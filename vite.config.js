import {defineConfig} from 'vite';
import inarisk from './api/inarisk.js';
import slope from './api/slope.js';
const proxy=server=>{server.middlewares.use('/api/inarisk',(req,res)=>{inarisk(req,res);});server.middlewares.use('/api/slope',(req,res)=>{slope(req,res);});};
export default defineConfig({plugins:[{name:'inarisk-official-proxy',configureServer:proxy,configurePreviewServer:proxy}]});
