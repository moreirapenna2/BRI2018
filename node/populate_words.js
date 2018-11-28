let mysql = require('mysql');
let stemmer = require('stemmer')

let bri_pool = mysql.createPool({
    connectionLimit: 100,
    host: "127.0.0.1",
    user: "wiki",
    password: "wiki123wikia",
    database: "bri",
    multipleStatements: true
});

let limit = 200;
let word_x_id_hashmap = {};

let get_word_id = function (word) {
    return new Promise(function (resolve, reject) {
        if (word_x_id_hashmap.hasOwnProperty(word)) {
            //console.log("Cache word hit: (" + word_x_id_hashmap[word] + "," + word + ")");
            resolve(word_x_id_hashmap[word]);
        } else {
            bri_pool.getConnection(function (err, con) {
                if (err) {
                    reject(err);
                } else {
                    con.query('INSERT IGNORE INTO word (word) VALUES ("' + word + '"); SELECT IF(LAST_INSERT_ID() != 0, LAST_INSERT_ID(), (SELECT id FROM word WHERE word = "' + word + '")) AS id', function (err, res) {
                            con.release();
                            if (err) reject(err);
                            //console.log("Inserted word: (" + res[1][0].id + "," + word + ")");
                            word_x_id_hashmap[word] = res[1][0].id;
                            resolve(res[1][0].id);
                        }
                    );
                }
            });
        }
    })
};

let insert_relation = function (word_id, article_id) {
    return new Promise(function (resolve, reject) {
        bri_pool.getConnection(function (err, con) {
            if (err) {
                con.release();
                reject(err);
            } else {

                con.query('INSERT IGNORE INTO rlContentWord (contentId,wordId) VALUES (' + article_id + ',' + word_id + ') ON DUPLICATE KEY UPDATE fij = fij + 1', function (err, res) {
                    con.release();
                    if (err) reject(err);
                    //console.log("Inserted relation");
                });
            }
        });
    })
};

let get_article_count = new Promise((resolve, reject) => {
    bri_pool.getConnection(function (err, con) {
        if (err) {
            con.release();
            reject(err);
        } else {
            con.query('SELECT COUNT(*) FROM content', function (err, res) {
                con.release();
                if (err) reject(err);
                resolve(res[0]['COUNT(*)']);
            });
        }
    });
});

let get_articles = function (offset) {
    return new Promise((resolve, reject) => {
        bri_pool.getConnection(function (err, con) {
            if (err) {
                con.release();
                reject(err);
            } else {
                con.query(
                    'SELECT * FROM content LIMIT ' + limit + ' OFFSET ' + offset
                    , function (err, result) {
                        if (err) throw err;
                        resolve(result);
                    });
            }
        });
    });
};

let process_word = function (word, article_id) {
    return get_word_id(word).then(word_id => {
        insert_relation(word_id, article_id).catch(function (err) {
            console.log('Insert rel err: ' + err);
            process_word(word, article_id);
        });
    }).catch(function (err) {
        console.log('Get word id err: ' + err);
        process_word(word, article_id);
    });
};

let process_articles = function (articles) {
    articles.forEach(function (article) {
        console.log("Processing: " + article['title']);
        if (article['text'].length !== 0) {
            let words = article['text'].toString().match(/([A-Za-z]+)/g).map(stemmer);
            words.forEach(function (word) {
                process_word(word, article['id']);
            });
        }
    });
};


get_article_count.then((article_count) => {
    async function process_all() {
        for (let offset = 0; offset < article_count; offset += limit) {
            console.log("Processing (" + offset + " / " + article_count + ")");
            await (get_articles(offset).then(process_articles));
        }
    }

    process_all().then(value => {
        bri_pool.getConnection(function (err, con) {
            if (err) throw err;
            con.query('UPDATE word A INNER JOIN (SELECT wordId, SUM(fij) AS cnt FROM rlContentWord GROUP BY wordId) B ON B.wordId = A.id SET A.ni = B.cnt;\n' +
                'UPDATE rlContentWord A INNER JOIN (SELECT contentId, wordId, fij, wij, ((1 + log(2, fij)) * log(2, (SELECT COUNT(*) FROM content)/word.ni)) AS new_wij FROM rlContentWord INNER JOIN word ON rlContentWord.wordId = word.id) B ON B.wordId = A.wordId AND B.contentId = A.contentId SET A.wij = B.new_wij;\n',
                function (err, res) {
                    console.log("Finished!");
                });
        });
    });
});

