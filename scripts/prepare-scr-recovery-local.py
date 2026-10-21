"""Build a disposable, unpublished recovery fixture; never writes its source database."""
import pathlib,sqlite3,json,hashlib,base64,sys
root=pathlib.Path.cwd();d=root/'data/scr-body-corpus/2025/recovery-reviewed';review=json.loads((d/'review.json').read_text());assert len(sys.argv)==3,'Pass source SQLite and a new /private/tmp/ fixture path'
p=pathlib.Path(sys.argv[2]).resolve();assert str(p).startswith('/private/tmp/') and p.suffix=='.sqlite' and not p.exists()
source=pathlib.Path(sys.argv[1]).resolve();assert source.is_file() and source.suffix=='.sqlite'
s=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True);c=sqlite3.connect(p);s.backup(c);s.close();p.chmod(0o600)
before=c.execute("SELECT * FROM judgments WHERE content_status='published' ORDER BY id").fetchall()
c.executescript((d/'metadata.sql').read_text());caps={v['source_key']:v for v in map(json.loads,(root/'data/scr-body-corpus/2025/scr-body-captures-2025.ndjson').read_text().strip().split('\n'))}
for r in review['records']:
 if r['status']!='recovered_candidate':continue
 cap=caps[r['source_key']];render=(d/'render'/f"{r['public_id']}.json").read_bytes();doc=json.loads(render)
 for kind,data,sha in [('source',cap['network']['responseText'].encode(),r['source_sha256']),('render',render,r['render_sha256'])]:
  assert hashlib.sha256(data).hexdigest()==sha;chunks=[data[i:i+24000] for i in range(0,len(data),24000)]
  c.execute('INSERT OR IGNORE INTO judgment_body_documents(sha256,kind,byte_count,chunk_count) VALUES(?,?,?,?)',(sha,kind,len(data),len(chunks)))
  for i,chunk in enumerate(chunks):c.execute('INSERT OR IGNORE INTO judgment_body_chunks(document_sha256,chunk_index,payload_base64) VALUES(?,?,?)',(sha,i,base64.b64encode(chunk).decode()))
  stored=c.execute('SELECT kind,byte_count,chunk_count FROM judgment_body_documents WHERE sha256=?',(sha,)).fetchone();assert stored==(kind,len(data),len(chunks))
  stored_chunks=c.execute('SELECT chunk_index,payload_base64 FROM judgment_body_chunks WHERE document_sha256=? ORDER BY chunk_index',(sha,)).fetchall();assert [x[0] for x in stored_chunks]==list(range(len(chunks)))
  actual=b''.join(base64.b64decode(x[1],validate=True) for x in stored_chunks);assert actual==data
 _,path,key=r['source_key'].split(':')
 c.execute("UPDATE judgments SET content_status='validated',body_storage='d1',body_source_sha256=?,body_render_sha256=?,body_source_bytes=?,body_render_bytes=?,body_word_count=?,body_captured_at=?,body_validated_at=CURRENT_TIMESTAMP,body_validation_version='scr-body-v1' WHERE source_citation_year=2025 AND source_path=? AND source_neutral_key=? AND content_status!='published'",(r['source_sha256'],r['render_sha256'],len(cap['network']['responseText'].encode()),len(render),doc['wordCount'],cap['captured_at'],path,key));assert c.execute('SELECT changes()').fetchone()[0]==1
assert before==c.execute("SELECT * FROM judgments WHERE content_status='published' ORDER BY id").fetchall();assert not c.execute('PRAGMA foreign_key_check').fetchall();c.commit();c.close();print(json.dumps({'disposable_database':str(p),'recovered_unpublished':review['recovered'],'body_objects_byte_verified':review['recovered']*2,'existing_published_records_unchanged':True}))
