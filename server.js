console.log('\033[2J');
console.log('//// Test Program Initialized ////');

var GLOBAL = {};
var http = require('http');
var https = require('https');
https.globalAgent.maxSockets = 1;
//http.maxSockets = 500;
var fs = require('fs');
//var urlm = require('url');
//var exec = require('child_process').exec;
var requestm = require('request');
var Download = require('download');
var progress = require('download-status');
//var process = require('process');
var battle = require('battle');
var Firebase = require('firebase');
var FB = new Firebase("https://bnetapi.firebaseio.com/");


var TIMEOUT_TIME = 120000;
var FILE_INCOMPLETE_FLAG = false;
var HOST = 'http://us.battle.net';
var SHOST = 'http://us.battle.net';
var serverUrl = 'https://us.api.battle.net/wow/auction/data/proudmoore?locale=en_US&apikey=4a4mkpwwmm8e57kr2wv7sdtqp4cvcrsd';
var KEY_ADDED = '?locale=en_US&apikey=4a4mkpwwmm8e57kr2wv7sdtqp4cvcrsd';
var sLOG;
var cLOG;

function InitLOG(){
    fs.exists('log.json',function(exists){
        process.stdout.write('\n');
        process.stdout.write('\n');
        console.log("--- LOADING LOG FILE ---");
        if(exists){
            var log = JSON.parse(fs.readFileSync('log.json', 'utf8'));
            var stats = fs.statSync('log.json');
            var fileSizeInBytes = stats["size"];
            console.log('> ' + fileSizeInBytes + " byte log file found!");
            sLOG = log;
            cLOG = log;
            FB.child('log').set(log);
            LookUpJSON();
        } else {
            console.log('--- !!! LOG FILE NOT FOUND !!! ---');
            console.log('--- Creating New Log File ---');
            var logInit = {
                lastModified: '',
                timeStamp: '',
                items: {}
            };
            fs.writeFileSync('log.json', JSON.stringify(logInit));
            console.log('--- New Log File Created, Restarting... ---');
            InitLOG();
        }


    });
} InitLOG();


function LookUpJSON(){
    process.stdout.write('\n');
    process.stdout.write('\n');
    console.log("--- CHECKING FOR NEW SNAPSHOT ---");
    var req = https.get(serverUrl, function(res) {
        var body = '';
        console.log("> StatusCode: " + res.statusCode);
        console.log("> " + serverUrl);

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            //console.log(body);
            var data = JSON.parse(body).files[0];
            console.log('> Latest File: ' + data.url);
            console.log('> Posted At  : ' + new Date(data.lastModified));
            cLOG.url = data.url;
            cLOG.lastChecked = Date.now();
            SaveCLOG();
            CheckIfNew(data);
        });
    }).on('error', function(e) {
        console.log("Got error: ", e);
        setTimeout(LookUpJSON,10000);
        req.abort();
    });
}

var CDATA;
function CheckIfNew(data){
    var timeStamp = StatusReport(data);
    var filename = 'data' + timeStamp + '.json';
    fs.exists(filename,function(exists){
        console.log('> Latest File Saved: ' + (sLOG.timeStamp ? sLOG.timeStamp : 'Never.'));
        console.log('> Current Available: ' + timeStamp);
        console.log('> Last Checked At: ' + new Date(sLOG.lastChecked));
        if(!exists){
            console.log('> Current auction snapshot is out of date...');
            url = (data.url + KEY_ADDED).replace(/^http:\/\//i, 'https://');
            GetNewFile(url,filename);
        } else {
            console.log('> Current auction snapshot is already up-to-date.');
            process.stdout.write('\n');
            process.stdout.write('\n');
            console.log('=== LOADING SAVED AUCTION SNAPSHOT ===');
            CDATA = JSON.parse(fs.readFileSync('currentData.json', 'utf8'));
            TIMEOUT_TIME = 300000;
            FB.child('itemNumbers').on('value',function(data){
                LoadWatchList();
            });

        }
    });
}

var LAST_MODIFIED;
var TIME_STAMP;
function StatusReport(data){
    process.stdout.write('\n');
    process.stdout.write('\n');
    console.log("--- SNAPSHOT STATUS REPORT ---");
    var url = data.url;
    var lastModified = data.lastModified;
    var date = new Date(lastModified);
    var timeStamp = date.getFullYear().toString().slice(-2) + '.'
        + ('0'+(date.getMonth()+1)).slice(-2) + '.'
        +  ('0' + date.getDate()).slice(-2) + '.'
        +  ('0' + date.getHours()).slice(-2) + '.'
        +  ('0' + date.getMinutes()).slice(-2);

    LAST_MODIFIED = lastModified;
    TIME_STAMP = timeStamp;

    var tSince = (new Date().getTime() - sLOG.lastModified);
    var tSinceSeconds = Math.round(tSince/1000);
    var tSinceMinutes = Math.round(tSinceSeconds/60);
    var tSinceHours = Math.round(tSinceMinutes/60);
    var tSinceDays = Math.round(tSinceHours/24);
    var tUnit;
    var since;
    if (tSinceMinutes < 60){
        since = tSinceMinutes + 'm';
    } else if (tSinceMinutes > 60){
        since = tSinceHours + 'h';
    } else if (tSinceHours > 24 ){
        since = tSinceDays + 'days'
    }

    var sinceUpdate = since ? (since + ' since last update.') : 'Has never been updated.';

    console.log('> ' + sinceUpdate);
    return timeStamp;
}



//.replace(/^http:\/\//i, 'https://')

function SaveAuctionData(data,filename){
    process.stdout.write('\n');
    console.log('=== Data Recieved... Saving Data... ===');
    fs.writeFileSync(filename, data);
    fs.writeFileSync('currentData.json', data);
    CDATA = data;
    cLOG.lastModified = LAST_MODIFIED;
    cLOG.timeStamp = TIME_STAMP;
    SaveCLOG();
    LoadWatchList();
}

function ConsumeAuctionResponse(res,filename){
    console.log('=== Consuming Response ===');
    var body = '';
    res.on('data',function(data){
        body += data;
        process.stdout.write(data);
        //process.stdout.write(".");
    });
    res.on('end',function(){
        SaveAuctionData(body,filename);
        console.log('It ended');
    })
}

function ProcessAuctionResponse(res,url,filename){
    console.log('=== Processing Response ===');
    var status = res.statusCode;
    //console.log(res);
    //console.log(url);
    //console.log(filename);

    if(status == '404'){
        console.log('status: ' + status);
        //TheEnd();
        REQ.abort();
        GetNewFile(url,filename);
    } else {
        console.log('status: ' + status);
        ConsumeAuctionResponse(res,filename);
    }

}

var REQ;
function GetNewFile(url,filename){
    process.stdout.write('\n');
    process.stdout.write('\n');
    console.log("=== ATTEMPTING TO RETRIEVE & SAVE NEW SNAPSHOT ===");
    console.log(url);

    REQ = https.get(url, function (res) {
        ProcessAuctionResponse(res, url, filename);
    });
}



function SaveCLOG(){
    fs.writeFileSync('log.json', JSON.stringify(cLOG));
    FB.child('log').set(cLOG);
    sLOG = cLOG;
}

function LoadWatchList(){
    process.stdout.write('\n');
    process.stdout.write('\n');
    console.log('=== LOADING WATCH LIST ===');
    try{
        FB.child('itemNumbers').once('value',function(dat){
            console.log('> Watch List Loaded.');
            var checkList = dat.val();
            //var checkListLength = checkList.length;
            console.log(checkList);

            for (var key in checkList) {
                var obj = checkList[key];
                var item = GetItemInfo(obj);
                if(item){
                    GetLowestPrice(item);
                }
            }

            //for(var i=0; checkListLength > i;i++){
            //    var itemID = checkList[i];
            //    var item = GetItemInfo(itemID);
            //    if(item){
            //        GetLowestPrice(item);
            //    } else {
            //        //console.log('> Item not yet cached');
            //    }
            //}

            clearTimeout(GLOBAL.thisTO);
            GLOBAL.thisTO = setTimeout(LookUpJSON,TIMEOUT_TIME);
        });


    }catch(e){
        console.log('Error in JSON file, please delete latest file. (' + e + ')');
        setTimeout(LookUpJSON,TIMEOUT_TIME);
        //LookUpJSON();
        //process.exit(1);
        //obj = JSON.parse(fs.readFileSync('currentDataBackup.json', 'utf8'));
    }




}

function GetLowestPrice(item){
    //var realm = CDATA.realm;
    var data = CDATA.auctions.auctions;
    var dataLength = data.length;
    var results = [];
    for(var i=0;i<dataLength;i++){
        if(data[i].item == item.id) results.push(data[i].buyout);
    }
    results.sort(function(a, b){return a-b});
    process.stdout.write('\n');
    var lowestBuyout = results[0];
    console.log('**** ' + item.name + ' - (' + item.id + ') *****');
    console.log('LOWEST_PRICE -> ' + (lowestBuyout/10000000).toFixed(1) + 'K');
    FB.child('watching').child(item.id).set({
        name: item.name,
        lowestBuyout: lowestBuyout
    });
    //console.log(GetItemInfo(itemID));
}


function GetItemInfo(itemID){
    var inCache = cLOG.items[itemID] ? true : false;
    //console.log(inCache);
    if(inCache){
        return cLOG.items[itemID];
    } else {
        RetrieveItemInfo(itemID);
        return false;
    }
}

function RetrieveItemInfo(itemID,context){
    var core = HOST + "/api/wow/item/" + itemID;
    var url = context ? core + "/"  + context : core;
    http.get(url, function(res) {
        var body = '';
        process.stdout.write('\n');
        console.log("=== Attempting New Item Lookup ===");
        console.log("> StatusCode: " + res.statusCode);
        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            //console.log('end' + itemID);
            var data = JSON.parse(body);
            if(data.name){
                cLOG.items[itemID] = data;
                SaveCLOG();
                LoadWatchList();
            } else {
                RetrieveItemInfo(itemID,data.availableContexts[0]);
            }


        });
    }).on('error', function(e) {
        console.log("Got error: ", e);
    });
}

function TheEnd(){
    console.log("The End");
}


//var file_url = url;
//var DOWNLOAD_DIR = '/';
//var download_file_wget = function(file_url) {
//
//    // extract the file name
//    var file_name = urlm.parse(file_url).pathname.split('/').pop();
//    // compose the wget command
//    var wget = 'wget ' + DOWNLOAD_DIR + ' ' + file_url;
//    // excute wget using child_process' exec function
//
//    var child = exec(wget, function(err, stdout, stderr) {
//        if (err) throw err;
//        else console.log(file_name + ' downloaded to ' + DOWNLOAD_DIR);
//    });
//};
//download_file_wget(url);
//console.log("> Snapshot will be named: " + filename);

//var client = battle.createClient({
//    apiKey: '4a4mkpwwmm8e57kr2wv7sdtqp4cvcrsd',
//    region: 'us'
//});
//
//client.auction({
//    realm: 'proudmoore',
//    region: 'us'
//},function(err,data){
//    console.log(data);
//});


//var download = new Download()
//    .get(url + '?apikey=4a4mkpwwmm8e57kr2wv7sdtqp4cvcrsd')
//    //.dest(filename)
//    .use(progress());
//
//download.run(function (err, files, stream) {
//    if (err) {
//        throw err;
//    }
//    console.log('File downloaded successfully!');
//});


//var options = {
//    'method' : 'GET',
//    'uri': url,
//    'headers': {
//        'Content-Type': 'application/json; charset=utf-8',
//        'Date': new Date().toUTCString(),
//        'Authorization': 'BNET CAUS5YMFED6D:' + signature
//    }
//};
//requestm(options || url, function (error, response, body) {
//    if (!error && response.statusCode == 200) {
//        console.log(body); // Print the google web page.
//    } else {
//        console.log(error);
//    }
//});








//var options = {
//    url: url,
//    headers: {
//        headers: {
//            'Content-Type': 'application/json',
//            'X-Originating-Ip': '107.131.12.43'
//        }
//    }
//};
//
//function callback(error, response, body) {
//    if (!error && response.statusCode == 200) {
//        var info = JSON.parse(body);
//        console.log(info);
//    } else {
//        console.log(error);
//        console.log(response);
//    }
//}
//
//requestm(options, callback);



//var options = {
//    url: url
//    //method: 'GET'
//    headers: {
//        'Content-Type': 'application/json',
//        'X-Originating-Ip': '107.131.12.43'
//    }
//};
//






//var req = http.get(url, function(jfile) {
//    var fullJFile = '';
//    var status = jfile.statusCode;
//    console.log("> StatusCode: " + status);
//    //if(status == '404') {
//    //    console.log('Retry later...');
//    //} else {
//    //    var file = fs.createWriteStream("test.json");
//    //    var request = http.get(url, function(response) {
//    //        response.pipe(file);
//    //        file.on('finish',function(){
//    //            file.close(function(){
//    //                console.log('file closed');
//    //            })
//    //        });
//    //    });
//    //}
//
//    if(status == '404'){
//        console.log('Retry later...');
//    } else {
//        process.stdout.write('> Loading...');
//        jfile.on('data', function(stream) {
//            fullJFile += stream;
//            process.stdout.write(".");
//        });
//
//        jfile.on('end', function() {
//            process.stdout.write('\n');
//            console.log('--- Data Recieved... Saving Data... ---');
//            fs.writeFileSync(filename, fullJFile);
//            fs.writeFileSync('currentData.json', fullJFile);
//            SaveCLOG();
//
//            TheEnd();
//            LoadWatchList();
//        });
//
//    }
//
//}).on('error', function(e) {
//    console.log("Got error: ", e);
//    //LoadWatchList();
//    setTimeout(GetNewFile(url,filename),60000);
//});
//
//req.setTimeout(60000,function(){
//    console.log('REQUEST TIMED OUT');
//})


//var timeout_wrapper = function( req ) {
//    return function( ) {
//        // do some logging, cleaning, etc. depending on req
//        FILE_INCOMPLETE_FLAG = true;
//        process.stdout.write('\n');
//        console.log("--- DOWNLOAD TIMED OUT, RESTARTING ---");
//        req.abort( );
//    };
//};
//var fn = timeout_wrapper( req );
//var timeout = setTimeout( fn, 999000 ); // set initial timeout


//var req = https.get(url, function (res) {
//    var fullJFile = '';
//    var status = res.statusCode;
//    console.log("> StatusCode: " + status);
//
//    if(status == '404'){
//        console.log('Retrying...');
//        clearTimeout( timeout );
//        Retry(10000);
//        //TheEnd();
//    } else {
//        process.stdout.write('> Loading...');
//
//        res.on('data', function (data) {
//            fullJFile += data;
//            process.stdout.write(".");
//            // reset timeout
//            clearTimeout( timeout );
//            timeout = setTimeout( fn, 30000 );
//        }).on('end', function () {
//            // clear timeout
//            clearTimeout( timeout );
//            if(FILE_INCOMPLETE_FLAG){
//                FILE_INCOMPLETE_FLAG = false;
//                console.log('Error Code: 4654321');
//                Retry(10000);
//                //GetNewFile(url,filename);
//                //TheEnd();
//            }else{
//                process.stdout.write('\n');
//                console.log('--- Data Recieved... Saving Data... ---');
//                fs.writeFileSync(filename, fullJFile);
//                fs.writeFileSync('currentData.json', fullJFile);
//                cLOG.lastModified = LAST_MODIFIED;
//                cLOG.timeStamp = TIME_STAMP;
//                SaveCLOG();
//                //TheEnd();
//                TIMEOUT_TIME = 300000;
//                LoadWatchList();
//            }
//
//        }).on('error', function (err) {
//            // clear timeout
//            clearTimeout( timeout );
//            console.log("Got error: " + err.message);
//            TheEnd();
//        });
//
//    }
//}).on('error', function(e) {
//    console.log("Got error: ", e);
//    clearTimeout( timeout );
//    //LoadWatchList();
//    Retry(10000);
//    //setTimeout(Retry,timeoutTime);
//    //GetNewFile(url,filename);
//    //Retry(timeoutTime);
//
//});
//    function Retry(timeoutTime){
//        console.log('Retrying in ' + timeoutTime/1000 + 's...');
//        setTimeout(function(){
//            GetNewFile(url,filename);
//        },timeoutTime)
//    }
//
//    var timeout_wrapper = function( req ) {
//        return function( ) {
//            // do some logging, cleaning, etc. depending on req
//            FILE_INCOMPLETE_FLAG = true;
//            process.stdout.write('\n');
//            console.log("--- DOWNLOAD TIMED OUT, RESTARTING ---");
//            req.abort( );
//        };
//    };
//
//// generate timeout handler
//    var fn = timeout_wrapper( req );
//
//// set initial timeout
//    var timeout = setTimeout( fn, 999000 );

//var fullJFile = '';
//var status = res.statusCode;
//console.log("> StatusCode: " + status);
//
//if(status == '404'){
//    console.log('Retrying...');
//    clearTimeout( timeout );
//    Retry(10000);
//    //TheEnd();
//} else {
//    process.stdout.write('> Loading...');
//
//    res.on('data', function (data) {
//        fullJFile += data;
//        process.stdout.write(".");
//        // reset timeout
//        clearTimeout( timeout );
//        timeout = setTimeout( fn, 30000 );
//    }).on('end', function () {
//        // clear timeout
//        clearTimeout( timeout );
//        if(FILE_INCOMPLETE_FLAG){
//            FILE_INCOMPLETE_FLAG = false;
//            console.log('Error Code: 4654321');
//            Retry(10000);
//            //GetNewFile(url,filename);
//            //TheEnd();
//        }else{
//            process.stdout.write('\n');
//            console.log('--- Data Recieved... Saving Data... ---');
//            fs.writeFileSync(filename, fullJFile);
//            fs.writeFileSync('currentData.json', fullJFile);
//            cLOG.lastModified = LAST_MODIFIED;
//            cLOG.timeStamp = TIME_STAMP;
//            SaveCLOG();
//            //TheEnd();
//            TIMEOUT_TIME = 300000;
//            LoadWatchList();
//        }
//
//    }).on('error', function (err) {
//        // clear timeout
//        clearTimeout( timeout );
//        console.log("Got error: " + err.message);
//        TheEnd();
//    });
//
//}
//function Retry(timeoutTime){
//    console.log('Retrying in ' + timeoutTime/1000 + 's...');
//    setTimeout(function(){
//        GetNewFile(url,filename);
//    },timeoutTime)
//}