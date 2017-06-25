var Evernote = require('evernote');

var config = require('../config.json');
var callbackUrl = "http://localhost:3000/oauth_callback";

const MongoClient = require('mongodb').MongoClient
var EvernoteData     = require('../models/evernote');

var mongoose   = require('mongoose');
mongoose.connect('mongodb://localhost/evernote'); // connect to our database

// home page
exports.index = function(req, res) {
  if (req.session.oauthAccessToken) {
    var token = req.session.oauthAccessToken;
    var client = new Evernote.Client({
      token: token,
      sandbox: config.SANDBOX,
      china: config.CHINA
    });
    client.getNoteStore().listNotebooks().then(function(notebooks) {
      req.session.notebooks = notebooks;
      res.render('index', {session: req.session});
    }, function(error) {
      req.session.error = JSON.stringify(error);
      res.render('index', {session: req.session});
    });
  } else {
    res.render('index', {session: req.session});
  }
};

// OAuth
exports.oauth = function(req, res) {
  var client = new Evernote.Client({
    consumerKey: config.API_CONSUMER_KEY,
    consumerSecret: config.API_CONSUMER_SECRET,
    sandbox: config.SANDBOX,
    china: config.CHINA
  });
  
  // get user id
  var userId = req.query.uid;
  console.log(userId)
  callbackUrl = callbackUrl + '?uid=' + userId;

  client.getRequestToken(callbackUrl, function(error, oauthToken, oauthTokenSecret, results) {
    if (error) {
      req.session.error = JSON.stringify(error);
      res.redirect('/');
    } else {
      // store the tokens in the session
      req.session.oauthToken = oauthToken;
      req.session.oauthTokenSecret = oauthTokenSecret;

      // store tokens to db
      let evernoteData = new EvernoteData();
      evernoteData.userId = userId
      evernoteData.oauthToken = oauthToken
      evernoteData.oauthTokenSecret = oauthTokenSecret
      console.log(evernoteData)
      evernoteData.save(
            function(err) {
              if (err)
                res.send(err);
              
              console.log('function complete 1.1')

              // redirect the user to authorize the token
              res.redirect(client.getAuthorizeUrl(oauthToken));
      })
      console.log('function complete 1')
      // redirect the user to authorize the token
      // res.redirect(client.getAuthorizeUrl(oauthToken));
    }
  });
};

// OAuth callback
exports.oauth_callback = function(req, res) {
  var client = new Evernote.Client({
    consumerKey: config.API_CONSUMER_KEY,
    consumerSecret: config.API_CONSUMER_SECRET,
    sandbox: config.SANDBOX,
    china: config.CHINA
  });
  
  // get user id
  var userId = req.query.uid;
  console.log(userId)

  client.getAccessToken(
    req.session.oauthToken, 
    req.session.oauthTokenSecret, 
    req.query.oauth_verifier,
    function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
      if (error) {
        console.log('error');
        console.log(error);
        res.redirect('/');
      } else {
        // store the access token in the session
        req.session.oauthAccessToken = oauthAccessToken;
        req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
        req.session.edamShard = results.edam_shard;
        req.session.edamUserId = results.edam_userId;
        req.session.edamExpires = results.edam_expires;
        req.session.edamNoteStoreUrl = results.edam_noteStoreUrl;
        req.session.edamWebApiUrlPrefix = results.edam_webApiUrlPrefix;

        EvernoteData.findOne({userId: userId}, function(err, evernoteData) {

            if (err)
                res.send(err);

            // save the access token to db
            evernoteData.userId = userId
            evernoteData.oauthAccessToken = oauthAccessToken
            evernoteData.oauthAccessTokenSecret = oauthAccessTokenSecret
            evernoteData.edamShard = results.edam_shard
            evernoteData.edamUserId= results.edam_userId
            evernoteData.edamExpires = results.edam_expires
            evernoteData.edamNoteStoreUrl = results.edam_noteStoreUrl
            evernoteData.edamWebApiUrlPrefix = results.edam_webApiUrlPrefix

            console.log(evernoteData)
            evernoteData.save(
                function(err) {
                  if (err)
                    res.send(err);
                  
                  console.log('function complete 2.1')
                  // redirect the user to authorize the token
                  res.redirect('/');
            })
        });

        console.log('function complete 2')
        
        // res.redirect('/');
      }
  });
};

// Clear session
exports.clear = function(req, res) {
  req.session.destroy();
  res.redirect('/');
};
