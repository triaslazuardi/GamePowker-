module.exports.Roomlist = Roomlist;
exports.clients = [];

function Roomlist(_id, _roomid, _roundid, _name, _max_player, _turn, _sb, _bb, _min_buy, _max_buy, _timer, _jackpot){
    this.id = _id;
    this.nameTable = _name;
    this.roomid = _roomid;
    this.roundid = _roundid;
    this.status = 0;
    this.sit = [];
    this.player = [];
    this.max_player = _max_player;
    this.active_player = 0;
    this.turn = _turn;
    this.pot = 0; // total semua bet player
    this.spreadPot = [];
    this.winBetArray = [];
     
    this.sb = _sb;
    this.bb = _bb;
    this.minBuy = _min_buy;
    this.maxBuy = _max_buy;

    this.bet = 0; // total bet player akhir
    this.raise = 0; //total bet player ketika mau raise 
    this.hand = 0;
    this.lasthand = 0;
	this.dealer = -1;
	this.isSB = -1;
    this.isBB = -1;
    this.lastBet = 0;
    this.lastTurn = 0;

    this.turntimer = _timer;
    this.timer = null;
    this.timeStart = 0;
    this.onTurnTimerElapse = 0;
    
    this.cardTable = [];
    this.playersPendingUpdate = [];
    this.playerWinner = [];
    this.msg = "";
    this.gamelog = "";

    this.autoplaythread=undefined;
    this.isrise = false;
    this.isallfold = false;
    this.riselevel=0;

    this.bet_fee=0;
    this.bet_point=0;
    this.win_exp=0;
    this.lose_exp=0;
    this.jackpot = _jackpot;
    this.jackpot_fee = 0;
    this.royal_flush = 0;
    this.straight_flush = 0;
    this.four_of_a_kind = 0;
    this.fullhouse = 0;
    this.flush = 0;
    this.same_jackpot = 0;
    this.type_jackpot = -1;
}


module.exports.Player = function (_sessionId, _userKey, _userid, _avatar, _socketid, _name, _seatid, _credit, _isplay, _auto_buyin){
    this.userid = _userid;
    this.name = _name;
    this.userkey = _userKey;
    this.sessionid = _sessionId;
    this.socketid = _socketid;
    this.seatid = _seatid;
    this.avatar = _avatar;
    this.credit = _credit;
    this.itemgift = 0;
    this.itemgiftcategory = 0;

    this.isplay = _isplay;
    this.isdone = false;
    this.isfold = false;

    this.isstand = false;
    this.isdisconnect = false;
    this.autobuyin = _auto_buyin;
    this.isautoplay = false;
    this.afkcounter = 0;

    this.card1 = 0;
    this.card2 = 0;
    this.bet = 0;  // total semua bet player 
    this.raise = 0; // total bet player saat ini
    this.action = "";
    this.win = 0;
    this.hands = [];
    this.valuecard = 0;
    this.typecard = "";
    this.typewin = "";
    this.roundgame = 0;
    this.islevelup = false;
    this.level = -1;

    this.jacpottype = -1;
    this.winjackpot = 0;
}

module.exports.Client = function Client(_ip, _socketid, _isadmin, _tableid, _userid, _username, _sessionId, _userKey, _avatar){
    this.sessionid=_sessionId;
    this.userkey=_userKey;

    this.userid = _userid;
    this.username=_username;
    this.avatar=_avatar;
        
    this.socketid=_socketid;
    this.tableid=_tableid;

    this.admin=_isadmin;
    this.ip = _ip;
}

exports.PushClient = async function(_client){
    console.log("[ Push Client : ] " , _client);

    if(_client.admin){
        let sameRoomAdmin = exports.clients.find(c => (c.userid == _client.userid && c.socketid == _client.socketid) || c.tableid == _client.tableid && c.admin);
        if (sameRoomAdmin == undefined)
          exports.clients.push(_client);
        else {
          exports.RemoveClient(sameRoomAdmin.userid);
          exports.clients.push(_client);
        }
    }else{
        if(exports.clients.find(c=>c.userid===_client.userid)===undefined){
            console.log("[ ==== NO HAVE CLIENT ==== ]");  
            exports.clients.push(_client);
        }else {
            console.log("[ ==== HAVE CLIENT ==== ]");  
            await exports.RemoveClient(_client.userid);
            exports.clients.push(_client);
        }
    }
}


exports.RemoveClient = async function(_uid){
    for(let x in exports.clients){
        if(exports.clients[x].userid == _uid){
            exports.clients.splice(x, 1);
        }
    } 
}

