const readline = require('readline');
let mysql = require('mysql');
let stemmer = require('stemmer');

let con = mysql.createConnection({
    host: "127.0.0.1",
    user: "wiki",
    password: "wiki123wikia",
    database: "bri",
    multipleStatements: true
});

let g_word_x_doc_count = {};
let get_words_count = async function () {
    return new Promise(function (resolve, reject) {
        con.query('SELECT w.id, w.word, count(*) FROM word w, rlContentWord cw WHERE w.id = cw.wordId GROUP BY w.id', function (err, res) {
            if (err) throw err;
            res.forEach(function (el) {
                g_word_x_doc_count[el['word']] = {id: el['id'], count: el['count(*)']};
            });
            resolve();
        });
    });
};

let get_articles_containing_word = async function (word_id) {
    return new Promise(function (resolve, reject) {
        con.query('SELECT contentId, wij FROM rlContentWord WHERE wordId = ' + word_id + ' ORDER BY wij DESC', function (err, res) {
            if (err) throw err;
            let ret = {};
            res.forEach(function (el) {
                ret[el['contentId']] = el['wij'];
            });
            resolve(ret);
        });
    })
};

let get_articles_content = async function (article_id) {
    return new Promise(function (resolve) {
        con.query('SELECT * FROM content WHERE id = ' + article_id, function (err, res) {
            if (err) throw err;
            resolve(res[0]);
        });
    });
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.setPrompt('Search> ');
rl.prompt();

rl.on('line', function (answer) {
    get_words_count().then(function () {

        let words = answer.split(" ").map(stemmer);

        let words_x_doc_count = [];
        words.forEach(word => {
            words_x_doc_count.push(g_word_x_doc_count[word]);
        });
        words_x_doc_count.sort((a, b) => {
            return a.count - b.count;
        });
        //console.log(words_x_doc_count);


        let promises = [];
        words_x_doc_count.forEach(function (el) {
            promises.push(get_articles_containing_word(el.id).then(function (word_x_content_rel) {
                el.content_rel = word_x_content_rel;
            }));
        });
        Promise.all(promises).then(function () {
            let intersection = Object.keys(words_x_doc_count[0].content_rel).map(Number);
            for (let i = 1; i < words_x_doc_count.length; i++) {
                intersection = intersection.filter(value => -1 !== Object.keys(words_x_doc_count[i].content_rel).map(Number).indexOf(value));
            }

            Promise.all(intersection.map(get_articles_content)).then(content_data_array => {
                let content_x_rating = {};
                let content_data = {};
                let i = 0;
                intersection.forEach(content_id => {
                    content_data[content_id] = content_data_array[i++];
                    words_x_doc_count.forEach(word_x_doc_count => {
                        if (content_x_rating.hasOwnProperty(content_id)) {
                            content_x_rating[content_id] += word_x_doc_count.content_rel[content_id];
                        } else {
                            content_x_rating[content_id] = word_x_doc_count.content_rel[content_id];
                        }
                    });
                });

                let content_x_rating_arr = Object.entries(content_x_rating);

                content_x_rating_arr.sort((a, b) => {
                    return b[1] - a[1];
                });

                content_x_rating_arr.forEach(value => {
                    let curr_content_data = content_data[value[0]];
                    console.log("====");
                    console.log("Title: " + curr_content_data.title.toString());
                    console.log("URL: " + curr_content_data.url.toString());
                    console.log("Rating: " + value[1]);
                    console.log("====");
                });

                rl.prompt();
            });
        });
    });
}).on('close', function () {
    console.log('Exiting');
    process.exit(0);
});