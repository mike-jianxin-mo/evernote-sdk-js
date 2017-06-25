var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var EvernoteDataSchema   = new Schema({
    userId: String,
    oauthToken : String,
    oauthTokenSecret : String,
    oauthAccessToken : String,
    oauthAccessTokenSecret : String,
    edamShard : String,
    edamUserId : String,
    edamExpires : String,
    edamNoteStoreUrl : String,
    edamWebApiUrlPrefix : String
});

module.exports = mongoose.model('EvernoteData', EvernoteDataSchema);




