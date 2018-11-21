//Return number of ocurrencies
//SELECT word.id, COUNT(word.id) FROM word INNER JOIN rlContentWord ON word.id  = rlContentWord.wordId GROUP BY word.id;


//Set word.ni
//SELECT wordId, contentId, COUNT(*) FROM (SELECT wordId, contentId FROM word INNER JOIN rlContentWord ON word.id  = rlContentWord.wordId) Q GROUP BY contentId;


//Set word.fij
//SELECT contentId, wordId, fij, wij, ((1 + log(2, fij)) * log(2, (SELECT COUNT(*) FROM content)/word.ni)) AS new_nij FROM rlContentWord INNER JOIN word ON rlContentWord.wordId = word.id;