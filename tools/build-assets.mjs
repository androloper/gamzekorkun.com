import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {PurgeCSS} from 'purgecss';
import postcss from 'postcss';
import {minify} from 'terser';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sitemap=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');
const pages=[...sitemap.matchAll(/<loc>https:\/\/gamzekorkun.com([^<]+)<\/loc>/g)].map(m=>path.join(root,m[1],'index.html'));
pages.push(path.join(root,'404.html'));
const sources=['css/fonts.css','style.css','css/icons/bootstrap-icons.css','demos/bubble-tea/bubble-tea.css','css/custom.css','css/seo.css'];
const controllers=['site','approaches','contact'];
const content=await Promise.all([...pages,...controllers.map(n=>path.join(root,`js/${n}.js`))].map(async file=>({raw:await fs.readFile(file,'utf8'),extension:path.extname(file).slice(1)})));
const css=await Promise.all(sources.map(async name=>{
  const ast=postcss.parse(await fs.readFile(path.join(root,name),'utf8'),{from:name});
  ast.walkDecls(decl=>{
    decl.value=decl.value.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,(all,quote,url)=>{
      if (/^(?:data:|https?:|\/|#)/.test(url)) return all;
      return `url(${quote}/${path.posix.normalize(path.posix.join(path.posix.dirname(name),url))}${quote})`;
    });
  });
  return {raw:ast.toString(),name};
}));
const result=await new PurgeCSS().purge({content,css,
  safelist:{standard:['site-js','is-expanded-menu','sticky-header','sticky-header-shrink','primary-menu-trigger-active','primary-menu-active','primary-menu-open','primary-menu-open-all','d-block','not-dark','dark',/^cp-cert/,/^cp-train/]},
  dynamicAttributes:['aria-expanded','aria-invalid','data-state','data-carousel-ready','data-carousel-state','data-bs-theme'],
  // Preserve font declarations and CSS variables; they also resolve through custom properties.
  fontFace:false,variables:false,keyframes:true});
const ast=postcss.parse(result.map(r=>r.css).join('\n'));
ast.walkComments(node=>{if(!/^!|license|copyright|bootstrap-icons/i.test(node.text.trim()))node.remove();});
ast.walk(node=>{
  node.raws.before='';
  if(node.type==='decl')node.raws.between=':';
  if(['rule','atrule'].includes(node.type)){node.raws.between=node.type==='atrule' && !node.nodes?'':' ';node.raws.after='';node.raws.semicolon=false;}
});
ast.raws.after='';
const builtCSS='/*! Site stylesheet: retained Canvas/Bootstrap styles and local overrides. Sources remain editable. */\n'+ast.toString();
await fs.writeFile(path.join(root,'css/site.min.css'),builtCSS);
const report={css:{sourceBytes:css.reduce((sum,c)=>sum+Buffer.byteLength(c.raw),0),builtBytes:Buffer.byteLength(builtCSS),gzipBytes:gzipSync(builtCSS).length},javascript:{}};
for(const name of controllers){
  const source=await fs.readFile(path.join(root,`js/${name}.js`),'utf8');
  const built=await minify(source,{ecma:2020,compress:{passes:2},mangle:true,format:{comments:/^!|license|copyright/i}});
  if(!built.code)throw Error(`Empty script: ${name}`);
  await fs.writeFile(path.join(root,`js/${name}.min.js`),built.code+'\n');
  report.javascript[name]={sourceBytes:Buffer.byteLength(source),builtBytes:Buffer.byteLength(built.code+'\n'),gzipBytes:gzipSync(built.code+'\n').length};
}
console.log(JSON.stringify(report,null,2));
