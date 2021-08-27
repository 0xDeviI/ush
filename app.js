const express = require('express');
const bodyParser = require('body-parser');
const validator = require('validator');
const app = new express();
const mongoose = require('mongoose');
const SHA512 = require('crypto-js/sha512');
const session = require('express-session');
var randomstring = require("randomstring");
var crc32 = require('crc32');
var validUrl = require('valid-url');
mongoose.connect('mongodb://localhost:27017/ush', { useNewUrlParser: true, useUnifiedTopology: true });

app.use(session({ secret: randomstring.generate(32), cookie: { maxAge: 60000 * 5 }, resave: false, saveUninitialized: true }));

const user = new mongoose.Schema({
    username: String,
    password: String
});

const link = new mongoose.Schema({
    origUrl: String,
    submitter_username: String,
    key_code: String,
    views: { type: Number, min: 0, default: 0 }
});

const User = mongoose.model('User', user);
const Link = mongoose.model('Link', link);

app.use(express.static(__dirname + '/views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.get('/', function(request, response) {
    response.sendFile(__dirname + '/views/main.html');
});

app.get('/account', function(request, response) {
    if (request.session.isLoggedIn == true)
        response.redirect("../");
    else
        response.sendFile(__dirname + '/views/account.html');
});

app.post('/shortit', function(request, response) {
    if (request.body == JSON.stringify({}))
        response.sendFile(__dirname + '/views/main.html');
    else if (request.body.url != undefined) {
        if (request.session.isLoggedIn == true) {
            var url = request.body.url;
            if (validUrl.isUri(url)) {
                var hashedUrl = crc32(url + ":" + request.session.loggedInUsername + ":" + new Date());
                Link.find({ key_code: hashedUrl }, function(err, res) {
                    if (err) {
                        response.send(JSON.stringify({ "error": true, "message": "database error" }));
                    } else {
                        if (res.length == 0) {
                            var newLink = new Link({ origUrl: url, submitter_username: request.session.loggedInUsername, key_code: hashedUrl });
                            newLink.save(function(err, res) {
                                if (err) {
                                    response.send(JSON.stringify({ "error": true, "message": "database error" }));

                                } else {
                                    response.send(JSON.stringify({ "error": false, "url": hashedUrl }));
                                }
                            });
                        } else {
                            response.send(JSON.stringify({ "error": false, "url": res[0].key_code }));
                        }
                    }
                });
            } else {
                response.send(JSON.stringify({ "error": true, "message": "not valid url" }));
            }
        } else {
            response.send(JSON.stringify({ "error": true, "message": "not loggedin" }));
        }
    } else {
        response.send(JSON.stringify({ "error": true }));
    }
});

app.get('/test', function(request, response) {
    response.sendFile(__dirname + '/views/index.html');
});

app.get('/u/*', function(request, response) {
    var hashCode = request.path.replace("/u/", "");
    Link.find({ key_code: hashCode }, function(err, res) {
        if (err) {
            response.send(JSON.stringify({ "error": true, "message": "database error" }));
        } else {
            if (res.length == 0) {
                response.redirect("../");
            } else {
                Link.updateOne({ key_code: hashCode }, { $inc: { views: 1 } }, { new: false, upsert: true }, function(err, _res) {
                    if (err) {
                        response.send(JSON.stringify({ "error": true, "message": "database error" }));
                    } else {
                        response.redirect(res[0].origUrl);
                    }
                });
            }
        }
    });
});

app.post('/account', function(request, response) {
    if (request.body == JSON.stringify({}))
        response.sendFile(__dirname + '/views/account.html');
    else if (request.body.username != undefined && request.body.password != undefined && request.body.method != undefined) {
        if (request.body.method == "signup") {
            let _username = request.body.username;
            let _password = SHA512(request.body.password);

            if (validator.isAlphanumeric(_username)) {
                User.find({ username: _username }, function(err, res) {
                    if (err) {
                        response.send(JSON.stringify({ "error": true, "message": "database error" }));
                    } else {
                        if (res.length == 0) {
                            var newUser = new User({ username: _username, password: _password });
                            newUser.save(function(err, obj) {
                                if (err) {
                                    response.send(JSON.stringify({ "error": true, "message": "database error" }));
                                } else {
                                    response.send(JSON.stringify({ "error": false, "message": "user added" }));
                                }
                            });
                        } else {
                            response.send(JSON.stringify({ "error": true, "message": "user exist" }));
                        }
                    }
                });
            } else {
                response.send(JSON.stringify({ "error": true, "message": "bad usernames" }));
            }
        } else if (request.body.method == "signin") {
            let _username = request.body.username;
            let _password = SHA512(request.body.password);

            if (validator.isAlphanumeric(_username)) {
                User.find({ username: _username }, function(err, res) {
                    if (err) {
                        response.send(JSON.stringify({ "error": true, "message": "database error" }));
                    } else {
                        if (res.length == 1) {
                            request.session.isLoggedIn = true;
                            request.session.loggedInUsername = _username;
                            response.send(JSON.stringify({ "error": false, "message": "found" }));
                        } else {
                            response.send(JSON.stringify({ "error": true, "message": "not found" }));
                        }
                    }
                });
            } else {
                response.send(JSON.stringify({ "error": true, "message": "bad usernames" }));
            }
        } else {
            response.send(JSON.stringify({ "error": true }));
        }
    } else {
        response.send(JSON.stringify({ "error": true }));
    }
});

app.listen(8080);
console.log("app is running on port http://127.0.0.1:8080");