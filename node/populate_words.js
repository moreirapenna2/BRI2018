let mysql = require('mysql');
let stemmer = require('stemmer');

let bri_pool = mysql.createPool({
    connectionLimit: 120,
    host: "127.0.0.1",
    user: "wiki",
    password: "wiki123wikia",
    database: "bri",
    multipleStatements: true
});

let limit = 10;
let word_x_id_hashmap = {};

let get_word_id = async function (word) {
    return new Promise(function (resolve, reject) {
        if (word_x_id_hashmap.hasOwnProperty(word)) {
            //console.log("Cache word hit: (" + word_x_id_hashmap[word] + "," + word + ")");
            resolve(word_x_id_hashmap[word]);
        } else {
            bri_pool.getConnection(function (err, con) {
                if (err) throw err;
                con.query('INSERT IGNORE INTO word (word) VALUES ("' + word + '"); SELECT id FROM word WHERE word = "' + word + '"', function (err, res) {
                        con.release();
                        if (err) throw err;
                        //console.log("Inserted word: (" + res[1][0].id + "," + word + ")");
                        word_x_id_hashmap[word] = res[1][0].id;
                        resolve(res[1][0].id);
                    }
                );

            });
        }
    })
};

let insert_relation = async function (word_id, article_id) {
    return new Promise(function (resolve, reject) {
        bri_pool.getConnection(function (err, con) {
            if (err) {
                con.release();
                if (err) throw err;
            } else {
                con.query('INSERT IGNORE INTO rlContentWord (contentId,wordId) VALUES (' + article_id + ',' + word_id + ') ON DUPLICATE KEY UPDATE fij = fij + 1', function (err, res) {
                    con.release();
                    if (err) throw err;
                    resolve(res);
                });
            }
        });
    })
};

let get_article_count = new Promise((resolve, reject) => {
    bri_pool.getConnection(function (err, con) {
        if (err) {
            con.release();
            if (err) throw err;
        } else {
            con.query('SELECT COUNT(*) FROM content', function (err, res) {
                con.release();
                if (err) throw err;
                resolve(res[0]['COUNT(*)']);
            });
        }
    });
});

let get_articles = async function (offset) {
    return new Promise((resolve, reject) => {
        bri_pool.getConnection(function (err, con) {
            if (err) {
                con.release();
                if (err) throw err;
            } else {
                con.query(
                    'SELECT * FROM content LIMIT ' + limit + ' OFFSET ' + offset
                    , function (err, result) {
                        con.release();
                        if (err) throw err;
                        resolve(result);
                    });
            }
        });
    });
};


let process_articles = async function (articles) {
    articles.forEach(function (article) {
        console.log("Processing: " + article['title']);
        if (article['text'].length !== 0) {
            let words = article['text'].toString().match(/([A-Za-z]+)/g).map(stemmer);
            words.forEach(function (word) {
                get_word_id(word).then(word_id => {
                    insert_relation(word_id, article['id']).then(value => {
                        console.log("Inserted (" + word + ", " + word_id + ") => ("+article['id']+". "+article['title']+")");
                    });
                });
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

