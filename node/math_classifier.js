let mysql = require('mysql');

let pool = mysql.createPool({
    connectionLimit: 10,
    host: "192.168.0.102",
    user: "wiki",
    password: "wiki123wikia",
    database: "wiki"
});

let offset = 100;

pool.getConnection(function (err, con) {
    if (err) throw err;
    console.log("Connected!");
    con.query('SELECT COUNT(*) FROM text', function (err, result) {
        let row_num = result[0]['COUNT(*)'];
        for (let i = 0; i < row_num; i += offset) {
            con.query(
                'SELECT old_id, old_text FROM text LIMIT ' + offset + ' OFFSET ' + i
                , function (err, result) {
                    let mathed = [];
                    if (err) throw err;


                    result.forEach(function (el, key) {
                        if (el['old_text'].toString('utf8').includes('<math')) {
                            mathed.push(el['old_id']);
                        }
                    });

                    console.log(mathed);

                    pool.getConnection(function (err, update_con) {
                        update_con.query('UPDATE text SET old_math = 1 WHERE old_id IN (' + mathed.join(',') + ')')
                    })

                });
        }
    });
});