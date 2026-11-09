const fs = require('fs');
const readline = require('readline');

async function processSql() {
  const inputFile = 'backup_database.sql';
  const outputFile = 'backup_ready_mysql.sql';

  const readStream = fs.createReadStream(inputFile, { encoding: 'utf-8' });
  const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf-8' });

  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity,
  });

  writeStream.write('SET FOREIGN_KEY_CHECKS = 0;\n');
  writeStream.write('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n\n');

  let buffer = '';
  let insideInsert = false;

  for await (const line of rl) {
    if (line.startsWith('--') || line.startsWith('/*')) continue;
    if (line.trim() === 'BEGIN;' || line.trim() === 'COMMIT;') continue;
    if (line.includes('CREATE TABLE') || line.includes('CONSTRAINT')) continue;
    if (line.includes('SELECT setval(')) continue;

    if (line.startsWith('INSERT INTO')) {
      insideInsert = true;
      buffer = line;
    } else if (insideInsert) {
      buffer += '\n' + line;
    }

    if (insideInsert && line.trim().endsWith(';')) {
      insideInsert = false;
      let cleanSql = buffer;

      // 1. Ganti Postgres ON CONFLICT menjadi MySQL ON DUPLICATE KEY UPDATE
      cleanSql = cleanSql.replace(/ON CONFLICT\s*\([^)]+\)\s*DO UPDATE SET\s+(.*?);$/is, (m, setClause) => {
        const mysqlSet = setClause.replace(/EXCLUDED\."([^"]+)"/g, 'VALUES(`$1`)');
        return `ON DUPLICATE KEY UPDATE ${mysqlSet};`;
      });
      cleanSql = cleanSql.replace(/ON CONFLICT\s*\([^)]+\)\s*DO NOTHING;?$/is, ';');

      // 2. Amankan array string Postgres ke placeholder JSON valid
      const placeholders = [];
      cleanSql = cleanSql.replace(/'((?:[^'\\]|\\.)*)'::text\[\]/g, (match, p1) => {
        let jsonStr = '[]';
        if (p1 && p1.trim() !== '') {
          const items = p1.split('","').map(item => {
            return item.replace(/^"/, '').replace(/"$/, '').trim();
          });
          jsonStr = JSON.stringify(items);
        }
        const ph = `___JSON_PLACEHOLDER_${placeholders.length}___`;
        const escapedLiteral = "'" + jsonStr.replace(/'/g, "''") + "'";
        placeholders.push({ ph, escapedLiteral });
        return ph;
      });

      // 3. Ganti petik ganda identifier ("User", "id") menjadi backtick (`User`, `id`)
      cleanSql = cleanSql.replace(/"/g, '`');

      // 4. Kembalikan literal JSON (petik dua di dalam JSON tetap utuh)
      for (const item of placeholders) {
        cleanSql = cleanSql.replace(item.ph, item.escapedLiteral);
      }

      writeStream.write(cleanSql + '\n');
      buffer = '';
    }
  }

  writeStream.write('\nSET FOREIGN_KEY_CHECKS = 1;\n');
  writeStream.end();

  console.log('✅ Konversi berhasil diperbaiki! File baru: backup_ready_mysql.sql');
}

processSql();
