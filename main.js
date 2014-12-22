/**
 * Created by John on 12/20/2014.
 */
var FB = new Firebase("https://bnetapi.firebaseio.com/");
var FBMI = FB.child('masterInput');

/**
 * Created by john.thantranon on 12/10/2014.
 */
var app = angular.module("theApp", ["firebase"]);

function MinutesSince(nt,ot,granularity){
    var g;
    switch(granularity){
        case 's':
            return Math.floor((nt-ot)/1000);
            break;
        case 'm':
            return Math.floor((nt-ot)/1000/60);
    }
}


app.controller("theController", ["$scope","$firebase", "$http", function($scope,$firebase,$http){
    $scope.lastUpdated = 'empty';
    FB.on('value',function(data){
        var dat = data.val();
        var log = dat.log;
        var lc = new Date(log.lastChecked);
        var ls = new Date(log.lastModified);

        $scope.lastChecked = lc.toTimeString();
        $scope.lastSaved = ls.toTimeString();
        $scope.dataAge =  'Auction data updated ' + MinutesSince(lc,ls,'m') + 'm ago';
        $scope.timeSinceLastChecked = MinutesSince(Date.now(),lc,'s') + 's ago.';
        clearInterval(window.clock);
        window.clock = setInterval(function(){
            $scope.timeSinceLastChecked = MinutesSince(Date.now(),lc,'s') + 's ago';
            $scope.$apply();
        },1000);
        $scope.watching = dat.watching;

        $scope.$apply();
    });

    $scope.info = {
        lastSaved:              'Last Saved  ',
        timeSinceLastChecked:   'Last Checked',
        dataAge:                'Data Age    '
    };

    $scope.AddWatch = function(){
        FB.child('itemNumbers').push($scope.watchAddition);
    };

    $scope.DisplayPrice = function(p){
        if(p < 10000000){
            if(p < 10000){
                return (p/100).toFixed(1) + ' Silver';
            } else {
                return (p/10000).toFixed(1) + ' Gold';
            }
        } else {
            return (p/10000000).toFixed(1) + 'K Gold';
        }
    };

    //for (var key in $scope.info) {
    //    var obj = $scope.info[key];
    //    for (var prop in obj) {
    //        if(obj.hasOwnProperty(prop)){
    //            alert(prop + " = " + obj[prop]);
    //        }
    //    }
    //}

}]);