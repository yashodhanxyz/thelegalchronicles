"""Rehearse the reviewed 2025 import locally, with a backup and byte reconciliation."""
import base64, hashlib, json, pathlib, re, sqlite3, sys, time, unicodedata
root = pathlib.Path.cwd()
assert len(sys.argv) == 2, 'Pass the local Wrangler SQLite database path'
path = pathlib.Path(sys.argv[1]).resolve()
assert '/.wrangler/state/v3/d1/' in str(path) and path.suffix == '.sqlite', 'Only a local Wrangler database is allowed'
directory = root / 'data/scr-body-corpus/2025/release-reviewed'
manifest = json.loads((directory / 'manifest.json').read_text())
review = json.loads((directory / 'review.json').read_text())
assert manifest['publication_status'] == 'not_published'
assert hashlib.sha256((directory/'inventory.ndjson').read_bytes()).hexdigest() == manifest['inventory_sha256']
assert hashlib.sha256((directory/'review.json').read_bytes()).hexdigest() == manifest['review_sha256']
records = [json.loads(line) for line in (directory/'inventory.ndjson').read_text().splitlines()]
assert len(records) == manifest['records'] == review['candidates']
connection = sqlite3.connect(path)
backup_path = pathlib.Path('/private/tmp') / ('tlc-before-reviewed-2025-' + str(time.time_ns()) + '.sqlite')
backup = sqlite3.connect(backup_path)
backup_path.chmod(0o600)
connection.backup(backup)
backup.close()
def existing_2026():
    return (connection.execute('SELECT * FROM judgments WHERE source_citation_year=2026 ORDER BY id').fetchall(), connection.execute('SELECT jj.*,d.name_source,d.name_normalized,d.slug FROM judgment_judges jj JOIN judgments j ON j.id=jj.judgment_id JOIN judges d ON d.id=jj.judge_id WHERE j.source_citation_year=2026 ORDER BY jj.judgment_id,jj.source_position').fetchall())
before = existing_2026()
connection.executescript((directory/'metadata.sql').read_text())
for file in manifest['files']:
    source = (root/file).resolve()
    assert str(source).startswith(str(directory.resolve()) + '/')
    connection.executescript(source.read_text())
verified_objects = 0
for sha in manifest['objects']:
    row = connection.execute('SELECT byte_count,chunk_count FROM judgment_body_documents WHERE sha256=?',(sha,)).fetchone()
    assert row, 'Missing body document'
    chunks = connection.execute('SELECT chunk_index,payload_base64 FROM judgment_body_chunks WHERE document_sha256=? ORDER BY chunk_index',(sha,)).fetchall()
    assert len(chunks)==row[1] and [i for i,_ in chunks]==list(range(row[1])), 'Chunk sequence differs'
    data=b''.join(base64.b64decode(value,validate=True) for _,value in chunks)
    assert len(data)==row[0] and hashlib.sha256(data).hexdigest()==sha, 'Body bytes differ'
    verified_objects += 1
connection.executescript((directory/'activate-validated.sql').read_text())
# Previous local previews may contain newly withheld metadata. Remove their
# eligibility and author flags; neither source bytes nor raw metadata is edited.
for exception in review['exceptions']:
    year,source_path,neutral=exception['source_key'].split(':')
    existing=connection.execute('SELECT id,content_status FROM judgments WHERE source_citation_year=? AND source_path=? AND source_neutral_key=?',(int(year),source_path,neutral)).fetchone()
    if existing:
        assert existing[1] != 'published', 'Refuse to silently unpublish an existing judgment'
        connection.execute("UPDATE judgments SET content_status='metadata_only' WHERE id=?",(existing[0],))
        connection.execute('UPDATE judgment_judges SET is_author=NULL WHERE judgment_id=?',(existing[0],))
connection.commit()
normalize=lambda value:re.sub('[^A-Z0-9]+',' ',unicodedata.normalize('NFKD',value).upper()).strip()
for record in records:
    lookup=record['source_lookup']
    row=connection.execute('SELECT id,content_status,bench_size FROM judgments WHERE source_citation_year=2025 AND source_path=? AND source_neutral_key=?',(lookup['path'],lookup['neutral_key'])).fetchone()
    assert row and row[1]=='validated' and row[2]==len(record['verified_judges'])
    actual=connection.execute('SELECT d.name_normalized,jj.source_position,jj.is_author FROM judgment_judges jj JOIN judges d ON d.id=jj.judge_id WHERE jj.judgment_id=? ORDER BY jj.source_position',(row[0],)).fetchall()
    expected=[(normalize(j['name_source']),j['source_position'],j['is_author']) for j in record['verified_judges']]
    assert actual==expected, 'Reviewed judge relationships differ'
assert before == existing_2026(), 'Existing 2026 records or relationships changed'
assert not connection.execute('PRAGMA foreign_key_check').fetchall()
assert connection.execute("SELECT COUNT(*) FROM judgments WHERE source_citation_year=2025 AND content_status='published'").fetchone()[0]==0
assert connection.execute("SELECT COUNT(*) FROM judgments WHERE source_citation_year=2025 AND content_status='validated'").fetchone()[0]==manifest['records']
report={'local_only':True,'year':2025,'validated':manifest['records'],'published':0,'withheld':review['withheld'],'source_render_objects_byte_verified':verified_objects,'judge_relationships_reconciled':True,'existing_2026_records_and_relationships_unchanged':True,'foreign_keys':'pass','backup':str(backup_path)}
output=root/'audits/2026-10-21-2025-expansion/reviewed-local-d1.json'
output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
