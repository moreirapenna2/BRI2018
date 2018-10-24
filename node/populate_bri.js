let mysql = require('mysql');
let fs = require('fs');

let pool = mysql.createPool({
    connectionLimit: 10,
    host: "127.0.0.1",
    user: "wiki",
    password: "wiki123wikia",
    database: "wiki"
});

let bri_pool = mysql.createPool({
    connectionLimit: 5,
    host: "127.0.0.1",
    user: "wiki",
    password: "wiki123wikia",
    database: "bri"
});

const child_process = require('child_process');


let offset = 100;


console.log("BRI Connected!");

pool.getConnection(function (err, con) {
    if (err) throw err;
    console.log("Wiki Connected!");
    con.query('SELECT COUNT(*) FROM text', function (err, result) {
        let row_num = result[0]['COUNT(*)'];
        for (let i = 0; i < row_num; i += offset) {
            con.query(
                'SELECT * FROM page INNER JOIN revision ON page.page_latest = revision.rev_id INNER JOIN text ON revision.rev_text_id = text.old_id LIMIT ' + offset + ' OFFSET ' + i
                , function (err, result) {
                    if (err) throw err;


                    result.forEach(function (el, key) {
                        bri_pool.getConnection(function (err, bri_con) {
                            if (err) throw err;
                            let title = el['page_title'].toString('utf8');
                            let url = "https://en.wikipedia.org/wiki/" + encodeURIComponent(el['page_title'].toString('utf8'));
                            let raw_text = el['old_text'].toString('utf8');

                            fs.writeFileSync("/tmp/bri_raw.txt", raw_text);
                            let clean_text = child_process.execSync('java -jar ../tools/MediaWikiCleaner.jar ../tools/tags.txt /tmp/bri_raw.txt ').toString('utf8');
                            console.log(title + ': done cleaning.');


                            console.log(title + ': inserting');
                            bri_con.query('INSERT INTO content (title, url, text, abstract) VALUES (?, ?, ?, ?)',
                                [title, url, clean_text, clean_text.substring(0, 128)], function (err) {
                                    if (err) throw err;
                                });
                            bri_con.release();
                        });

                    });

                    /*result.forEach(function (el, key) {
                        if (el['old_text'].toString('utf8').includes('<math')) {
                            mathed.push(el['old_id']);
                        }
                    });

                    console.log(mathed);

                    pool.getConnection(function (err, update_con) {
                        update_con.query('UPDATE text SET old_math = 1 WHERE old_id IN (' + mathed.join(',') + ')')
                    })
                    */

                });
        }
    });
});
