const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

app.use('/', express.static('static'));

app.get('/api', function(req, res) {
    const data = require('./data.json');
    res.json(data.points);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
