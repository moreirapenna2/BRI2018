let mysql = require('mysql');
let stemmer = require('stemmer')

let pool = mysql.createPool({
    connectionLimit: 3,
    host: "127.0.0.1",
    user: "wiki",
    password: "wiki123wikia",
    database: "bri"
});

let bri_pool = mysql.createPool({
    connectionLimit: 10,
    host: "127.0.0.1",
    user: "wiki",
    password: "wiki123wikia",
    database: "bri",
    multipleStatements: true
});

const child_process = require('child_process');


let get_word_id = function (word) {
    return 'START TRANSACTION\n' +
        '    INSERT IGNORE INTO word (word) VALUES (\'\');\n' +
        '    SELECT IF(LAST_INSERT_ID() != 0, LAST_INSERT_ID(), (SELECT id FROM word WHERE word = \'a\')) AS id;\n' +
        'COMMIT;';
};

let offset = 100;


console.log("BRI Connected!");

pool.getConnection(function (err, con) {
    if (err) throw err;
    console.log("Wiki Connected!");
    con.query('SELECT COUNT(*) FROM content', function (err, result) {
        let row_num = result[0]['COUNT(*)'];
        for (let i = 0; i < row_num; i += offset) {
            con.query(
                'SELECT * FROM content LIMIT ' + offset + ' OFFSET ' + i
                , function (err, result) {
                    if (err) throw err;

                    result.forEach(function (content, key) {
                        if (err) throw err;
                        if (content['text'].length !== 0) {
                            let words = content['text'].toString().match(/([A-Za-z]+)/g).map(stemmer);

                            bri_pool.getConnection(function (err, bri_con) {
                                words.forEach(function (el, key) {
                                    if (err) throw err;
                                    bri_con.query('INSERT IGNORE INTO word (word) VALUES ("' + el + '"); SELECT IF(LAST_INSERT_ID() != 0, LAST_INSERT_ID(), (SELECT id FROM word WHERE word = "' + el + '")) AS id', function (err, res) {
                                            bri_con.release();
                                            if (err) throw err;
                                            let word_id = res[1][0].id;

                                            bri_con.query('INSERT IGNORE INTO rlContentWord (contentId,wordId) VALUES (' + content['id'] + ',' + word_id + ') ON DUPLICATE KEY UPDATE fij = fij + 1', function (err, res) {
                                                bri_con.release();
                                                if (err) throw err;
                                            });
                                        }
                                    );
                                });
                            });
                        }
                    })
                });

        }
    });
});