const requests = require('./requests');
const endpoints = require('./endpoints');   // endpoints of API
const base64 = require('file-base64');

const fs = require('fs');
const Q = require('q');

const HEADERS = {
    'User-Agent': 'nodeAPIv1.0'
};

/**
 * Utils
 */
// serialize dictionary to GET params
function serialize_dict(obj) {
    var str = [];
    for (var p in obj)
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    return str.join("&");
}

// function to encode file data to base64 encoded string
function base64_encode(file) {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
}

/**
 * End utils
 */


// private variables
var _access_key = undefined, _username = undefined, _password = undefined,
    _affiliate_id = undefined;

// set access_key
exports.set_access_key = function (access_key) {
    _access_key = access_key;
};

// set user and password - legacy
exports.set_user_password = function (user, password) {
    _username = user;
    _password = password;
};

// set affiliate id
exports.set_affiliate_id = function (aff_id) {
    _affiliate_id = aff_id;
};

// get account balance
exports.account_balance = function () {
    var deferred = Q.defer();
    var data = {}, url = undefined;
    if (_username && _password) {
        url = endpoints.BALANCE_ENDPOINT;
        // legacy auth
        data['username'] = _username;
        data['password'] = _password;
    }
    else {
        url = endpoints.BALANCE_ENDPOINT_TOKEN;
        data['token'] = _access_key;    // token auth
    }

    // add rest of params
    data['action'] = 'REQUESTBALANCE';
    data['submit'] = 'Submit';

    var params = serialize_dict(data);

    // submit to server
    requests.get(url + "?" + params, {headers: HEADERS}).then(function (resp) {
        deferred.resolve(resp);
    }).catch(function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
};

// solve captcha - image
exports.solve_captcha = function (image, case_sensitive) {
    var deferred = Q.defer();
    var data = {}, url = undefined, img_data = undefined;
    if (_username && _password) {
        // legacy auth
        data['username'] = _username;
        data['password'] = _password;
        url = endpoints.CAPTCHA_ENDPOINT;
        if (!fs.existsSync(image)) {
            // image does not exist
            deferred.reject(new Error('image does not exist: ' + image));
            return deferred.promise;
        }
        // get b64 of image
        img_data = base64_encode(image);
    }
    else {
        // given image is URL (works only for token based auth currently)
        if (image.startsWith('http')) {
            url = endpoints.CAPTCHA_ENDPOINT_URL_TOKEN;
            img_data = image;
        }
        else {
            // token based auth and file image
            url = endpoints.CAPTCHA_ENDPOINT_CONTENT_TOKEN;
            if (!fs.existsSync(image)) {
                // image does not exist
                deferred.reject(new Error('image does not exist: ' + image));
                return deferred.promise;
            }
            img_data = base64_encode(image);
        }
        data['token'] = _access_key;
    }

    // add rest of params
    data['action'] = 'UPLOADCAPTCHA';
    data['chkCase'] = case_sensitive == true ? '1' : '0';
    data['file'] = img_data;

    // check for affiliate id
    if (_affiliate_id) data['affiliateid'] = _affiliate_id;

    // submit to server
    requests.post(url, data).then(function (resp) {
        var s = resp.split('|');
        var ss = s.length >= 2 ? s[1] : s[0];
        deferred.resolve(ss);
    }).catch(function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
};

// submit recaptcha details
exports.submit_recaptcha = function (page_url, sitekey, proxy, proxy_type) {
    var deferred = Q.defer();
    var data = {}, url = undefined;
    if (_username && _password) {
        // legacy auth
        data['username'] = _username;
        data['password'] = _password;
        url = endpoints.RECAPTCHA_SUBMIT_ENDPOINT;
    }
    else {
        // token auth
        data['token'] = _access_key;
        url = endpoints.RECAPTCHA_SUBMIT_ENDPOINT_TOKEN;
    }

    // check for proxy
    if (proxy && proxy_type) {
        data['proxy'] = proxy;
        data['proxytype'] = proxy_type;
    }

    // add rest of params
    data['action'] = 'UPLOADCAPTCHA';
    data['pageurl'] = page_url;
    data['googlekey'] = sitekey;

    // check for affiliate id
    if (_affiliate_id) data['affiliateid'] = _affiliate_id;

    // submit to server
    requests.post(url, data).then(function (resp) {
        var s = resp.split('|');
        var ss = s.length >= 2 ? s[1] : s[0];
        deferred.resolve(ss);
    }).catch(function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
};

// get gresponse
exports.retrieve_recaptcha = function (captcha_id) {
    var deferred = Q.defer();
    var data = {}, url = undefined;
    if (_username && _password) {
        // legacy auth
        data['username'] = _username;
        data['password'] = _password;
        url = endpoints.RECAPTCHA_RETRIEVE_ENDPOINT;
    }
    else {
        // token auth
        data['token'] = _access_key;
        url = endpoints.RECAPTCHA_RETRIEVE_ENDPOINT_TOKEN;
    }

    // add rest of params
    data['action'] = 'GETTEXT';
    data['captchaid'] = captcha_id;

    // check progress
    // --------------
    function check_progress() {
        // submit to server
        requests.post(url, data).then(function (resp) {
            var s = resp.split('|');
            var ss = s.length >= 2 ? s[1] : s[0];
            deferred.resolve(ss);
        }).catch(function (err) {
            err = err.trim();
            // if 'NOT_DECODED' throw error
            if (err.endsWith('NOT_DECODED')) {
                // we're in NOT_DECODED
                return setTimeout(check_progress, 3000);       // recheck progress after 3 seconds
            }
            // other error, reject
            deferred.reject(err);
        });
    }
    check_progress();   // start checking progress
    return deferred.promise;
};

// set captcha bad
exports.set_captcha_bad = function (captcha_id) {
    var deferred = Q.defer();
    var data = {}, url = undefined;
    if (_username && _password) {
        url = endpoints.BAD_IMAGE_ENDPOINT;
        // legacy auth
        data['username'] = _username;
        data['password'] = _password;
    }
    else {
        url = endpoints.BAD_IMAGE_ENDPOINT_TOKEN;
        data['token'] = _access_key;    // token auth
    }

    // add rest of params
    data['action'] = 'SETBADIMAGE';
    data['imageid'] = captcha_id;
    data['submit'] = 'Submissssst';

    // submit to server
    requests.post(url, data, {headers: HEADERS}).then(function (resp) {
        deferred.resolve(resp);
    }).catch(function (err) {
        deferred.reject(err);
    });
    return deferred.promise;

};