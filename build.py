import json
t=open('worker.template.js',encoding='utf-8').read()
open('src/index.js','w',encoding='utf-8').write(t)
html=open('public/index.html',encoding='utf-8').read()
open('panel/worker.js','w',encoding='utf-8').write(t.replace('/*__INDEX_HTML__*/null', json.dumps(html,ensure_ascii=False).replace('</','<\\/')))
