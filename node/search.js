const readline = require('readline');
let mysql = require('mysql');
let stemmer = require('stemmer');
let limit_by = 10;

let bri_pool = mysql.createPool({
    connectionLimit: 120,
    host: "127.0.0.1",
    user: "wiki",
    password: "wiki123wikia",
    database: "bri",
    multipleStatements: true
});

let g_word_x_doc_count = {};
let get_words_count = async function () {
    return new Promise(function (resolve, reject) {
        bri_pool.getConnection(function (err, con) {
            con.query('SELECT w.id, w.word, count(*) FROM word w, rlContentWord cw WHERE w.id = cw.wordId GROUP BY w.id', function (err, res) {
                con.release();
                if (err) throw err;
                res.forEach(function (el) {
                    g_word_x_doc_count[el['word']] = {
                        id: el['id'],
                        count: el['count(*)'],
                        content_x_wij_arr: [],
                        content_x_wij_map: [],
                        content_ids: []
                    };
                });
                resolve();
            });
        });
    });
};

let get_articles_containing_word = async function (word_id) {
    return new Promise(function (resolve, reject) {
        bri_pool.getConnection(function (err, con) {
            con.query('SELECT contentId, wij FROM rlContentWord WHERE wordId = ' + word_id + ' ORDER BY wij DESC', function (err, res) {
                con.release();
                if (err) throw err;
                let content_rel = [];
                let content_ids = [];
                let content_x_word_map = {};
                res.forEach(function (el) {
                    content_rel.push([el['contentId'], el['wij']]);
                    content_x_word_map[el['contentId']] = el['wij'];
                });
                resolve({
                    content_x_wij_arr: content_rel,//(content_id, wij)
                    content_x_wij_map: content_x_word_map//(content_id => wij)
                });
            });
        });
    })
};

let get_articles_content = async function (cid_x_wij_pair_arr) {
    let content_ids = cid_x_wij_pair_arr.map(function (cid_x_wij_pair) {
        return cid_x_wij_pair[0];
    });
    return new Promise(function (resolve) {
        bri_pool.getConnection(function (err, con) {
            con.query('SELECT * FROM content WHERE id IN (' + content_ids.join() + ') ORDER BY FIELD(id, ' + content_ids.join() + ');', function (err, res) {
                con.release();
                if (err) throw err;
                resolve(res);
            });
        });
    });
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


console.log("Loading...");


get_words_count().then(function () {
    rl.setPrompt('Search> ');
    rl.prompt();

    rl.on('line', function (answer) {
        if (answer === "") {
            console.log("Please enter an valid search query");
            rl.prompt();
            return;
        }

        let search_start_time = Date.now();
        let words = answer.split(" ").map(stemmer);
        let words_x_doc_count = [];


        for (let i = 0; i < words.length; i++) {
            if(g_word_x_doc_count.hasOwnProperty(words[i])) {
                words_x_doc_count.push(g_word_x_doc_count[words[i]]);
            }else{
                console.log("No results found (word " + words[i]+ " doesn't exists in our database)");
                console.log("Search took: " + (Date.now() - search_start_time) + " ms");
                rl.prompt();
                return;
            }
        }

        words_x_doc_count.sort((a, b) => {
            return a.count - b.count;
        });
        //console.log(words_x_doc_count);

        let promises = [];
        words_x_doc_count.forEach(function (el) {
            promises.push(get_articles_containing_word(el.id).then(function (results) {
                el.content_x_wij_arr = results.content_x_wij_arr;
                el.content_x_wij_map = results.content_x_wij_map;
            }));

        });
        Promise.all(promises).then(function () {

                //Filter intersection and calculate Wij sum
                let intersection = words_x_doc_count[0].content_x_wij_arr;
                for (let i = 1; i < words_x_doc_count.length; i++) {
                    intersection = intersection.filter(function (cid_wij_pair) {
                        if (words_x_doc_count[i].content_x_wij_map.hasOwnProperty(cid_wij_pair[0])) {
                            //content IS in the new set
                            cid_wij_pair[1] += words_x_doc_count[i].content_x_wij_map[cid_wij_pair[0]];
                            return true;
                        }
                        return false;
                    });
                }

                if (intersection.length === 0) {
                    console.log("No results found");
                    console.log("Search took: " + (Date.now() - search_start_time) + " ms");
                    rl.prompt();
                    return;
                }

                intersection.sort((a, b) => {
                    return b[1] - a[1];
                });

                if (intersection.length > limit_by)
                    intersection.length = limit_by;

                get_articles_content(intersection).then(content_data_array => {
                    let i = 0;
                    intersection.forEach(cid_wij_pair => {
                        let content_data = content_data_array[i++];//I know that content_data_array's order is sync'd with intersection's order

                        console.log("====");
                        console.log("Title: " + content_data.title.toString());
                        console.log("URL: " + content_data.url.toString());
                        console.log("Rating: " + cid_wij_pair[1]);
                        console.log("====");
                    });

                    console.log("Search took: " + (Date.now() - search_start_time) + " ms");

                    rl.prompt();
                });
            }
        );
    });
});