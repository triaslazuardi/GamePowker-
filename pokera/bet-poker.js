const Tpk = require('./poker');
const FuncGlobal = require('../../include/func-global.js');
const QueryGlobal = require('../global/global_query.js');
const ConsoleOutput = require('../casino_menu/console_output');
const DBCommand = require('./db_command');
const Secure = require('../casino_menu/secure');

exports.StartRound = async function(tableid, io, roomlist)
{
    console.log(ConsoleOutput.BgFontYellow, "= = = = = = = START ROUND START = = = = = = = = =");
    let rooms = roomlist[tableid];
    // let str_log = '{"game_state":"NEW_ROUND","hand":'+roomlist[tableid].hand;
    let firstbet = 0;
    console.log(ConsoleOutput.BgFontGreen, "START ROUND FIRST  : ", rooms);
    rooms.turn = CekDealerTurn(rooms, tableid);

    if (exports.PlayerInGame(rooms) > 2){
        rooms.turn = Tpk.GetNextTurn(tableid);
    }

	for (var i = 0; i < 2; i++){
        let player = rooms.player[rooms.turn];

		if (firstbet != 1){
			if (player.credit > rooms.sb){
				player.credit = player.credit - rooms.sb;
                player.bet = rooms.sb;
                player.raise = rooms.sb;
                player.isdone = false;
                rooms.pot += rooms.sb;
                rooms.bet = rooms.sb;
			} else {
                player.bet = player.credit;
                player.raise = player.credit;
                player.credit = 0;
                player.isdone = true;
                rooms.pot += player.bet;
                rooms.bet = player.credit;
			}
			firstbet++;
            player.action = 7;
            player.isaction = 1;
            rooms.isSB = rooms.turn;

            // await Secure.PlayerBetting(player.userid, player.bet, player.credit, Tpk.idgame);

            rooms.turn =  Tpk.GetNextTurn(tableid);
		} else {
			if (player.credit > rooms.bb){
				player.credit = player.credit - rooms.bb;
                player.bet = rooms.bb;
                player.raise = rooms.bb;
                rooms.pot += rooms.bb;
                rooms.bet = rooms.bb;
                rooms.lastBet = rooms.bb
                rooms.raise = rooms.lastBet * 2
			} else {

                player.bet = player.credit;
                player.raise = player.credit;
                rooms.pot += player.bet;
                rooms.bet = rooms.bb;
                rooms.lastBet = rooms.bb;
                rooms.raise = rooms.bb * 2;
                player.credit = 0;
			}
                player.action = 6;
                player.isdone = true;
                player.isaction = 1;
                rooms.isBB = rooms.turn;
                rooms.lastTurn = roomlist[tableid].turn;

            // await Secure.PlayerBetting(player.userid, player.bet, player.credit, Tpk.idgame);
            console.log(ConsoleOutput.BgFontGreen, "SELESAI BB ROOMS : ", rooms);
            rooms.turn = Tpk.GetNextTurn(tableid);
		}
    }
    
    let param = {};  
    param["dataTable"] = {dealer : rooms.dealer, hand: roomlist[tableid].hand}
    
    for(let i_sit = 0; i_sit < 9; i_sit++){
        if (rooms.active_player == 0) continue;
        if (rooms.player[i_sit].userid == undefined) continue;

        param["player" + i_sit] = {
            userid: parseInt(rooms.player[i_sit].userid),
            seatid: parseInt(rooms.player[i_sit].seatid),
            credit: parseFloat(rooms.player[i_sit].credit),
            isplay: rooms.player[i_sit].isplay ? 1:0, // parseInt(rooms.player[i_sit].isplay),
            isfold: rooms.player[i_sit].isfold ? 1:0, //parseInt(rooms.player[i_sit].isfold),
            isaction:parseInt(rooms.player[i_sit].isaction),
            raise : parseFloat(rooms.player[i_sit].raise),
            action : parseInt(rooms.player[i_sit].action)
        }
    }

    Tpk.BroadcastEmit(io, tableid, 'roundstart_sender', param);
    // io.to(Tpk.GetTableName(tableid)).emit('roundstart_sender', param);
    setTimeout(Tpk.GameState,3000, tableid, io, rooms.hand+1);

    await DBCommand.StartRoundLog(rooms, tableid);

}

exports.FoldAction = async function(_io, _tableId, _roomlist, _targetSit, _fromstand){
    try{
        console.log(ConsoleOutput.BgFontMagenta, "= = = = = = = TURN FOLD START = = = = = = = = = TURN : " +_roomlist[_tableId].turn);
        console.log(ConsoleOutput.BgFontGreen,"TableID : ", _tableId);
        
        let islocal= false;
        let rooms = _roomlist[_tableId];
        let player = rooms.player[_targetSit];
        // let param;
        console.log(ConsoleOutput.BgFontMagenta, ">>> FOLD DATA! " , rooms.timer);
        if(player.userid == undefined) {throw err('Player Not Found In Fold Action');}
    
        rooms.lasthand = rooms.hand;
        rooms.msg = "GAME_PLAYER_GOES_FOLD";
        player.action = 3;
        player.isfold = true;
        player.isdone = true;
    
        await DBCommand.GameLog(rooms, _tableId, rooms.turn, "TURN_BET", 3, 0);
        await DBCommand.InsertTpkTable(rooms, _tableId);
    
        await SendActionPlayer(_io, player, _tableId);
    
        if (_targetSit == rooms.turn){
            rooms.turn = Tpk.GetNextTurn(_tableId);
            Tpk.StopTimer(rooms);
            islocal= true;
        }
    
        if (_targetSit == rooms.lastTurn){
            rooms.lastTurn = rooms.turn;
        }
    console.log(ConsoleOutput.BgFontMagenta," rooms turn : " + rooms.turn);
        if(exports.GetAllStatusAllin(rooms)){
            console.log(ConsoleOutput.BgFontBlue," In fold find get all status Allin");
            rooms.lasthand = rooms.hand;
            // Tpk.StopTimer(rooms);
            exports.SendWinHand(_io, rooms, _tableId);
        } else if(exports.GetAllStatusfold(rooms)){
            console.log(ConsoleOutput.BgFontBlue," In fold find get all status All Fold");
            console.log(ConsoleOutput.BgFontBlue," hand >> " + rooms.hand);
            if(_fromstand){
                await Tpk.Delay(1100);
            }else {
                await Tpk.Delay(300);
            }
                    
            await AllFoldSetWinner(_io, rooms, _tableId);
            // Tpk.StopTimer(rooms);
            return;
        }else if (exports.GetStatusPlayer(rooms)){
            console.log(ConsoleOutput.BgFontBlue," In fold find get GetStatusPlayer");
            if(rooms.turn != -1 && !rooms.player[rooms.turn].isdone && rooms.bet !=0){
                await SendNextHand(_io, rooms, _tableId);
            } else {
                rooms.lasthand = rooms.hand;
                if (rooms.hand < 10){
                    exports.SendWinHand(_io, rooms, _tableId);
                }else{
                    rooms.hand = 11;
                    Tpk.GameState(_tableId, _io, rooms.hand);
                } 
            }
        }else if(exports.ActionPlayerIsDone(rooms)){
            console.log(ConsoleOutput.BgFontBlue," In fold if next state(ActionPlayerIsDone)");
            rooms.hand += 1;
            rooms.bet = 0;
            rooms.lastBet = rooms.bet;
            rooms.raise = rooms.bb;
            await NextTurnInNewHand(rooms, _tableId);
            rooms.lastTurn = rooms.turn;
            Tpk.GameState(_tableId, _io, rooms.hand);
        }else {
            if(islocal){
                setTimeout(SendDataStateGame, 500, _io, rooms, _tableId);
                islocal = false;
            }
            
        }
        console.log(ConsoleOutput.BgFontMagenta, ">>> FOLD DATA! " , rooms.timer);
        console.log(ConsoleOutput.BgFontMagenta, "= = = = = = = TURN FOLD FINISH = = = = = = = = =");    
    }catch (err){
        console.log(ConsoleOutput.ErrorFont, "[ ERROR HANDLE ACTION ]  : " + err);
        QueryGlobal.DumpError(err);
    }
   
}

exports.HandleAction = async function(_io, _tableId, _action, _typeAction, _betAmount, _roomlist, _userId){
    try{
        console.log(ConsoleOutput.BgFontYellow, "= = = = = = = HANDLE ACTION START = = = = = = = = =");
        console.log(ConsoleOutput.BgFontGreen, "DATA : ", _tableId);
        let rooms = _roomlist[_tableId];
        let turn = rooms.turn;

        let player = rooms.player.find(p=>(p.userid==_userId));
        if(player == undefined) {throw Error('Player Not Found In Handle Action');}
        if(_userId != rooms.player[turn].userid) {throw Error('Player Not Same In Handle Action');}
          
        let betamount = 0;
        rooms.lasthand = rooms.hand;
        console.log(ConsoleOutput.BgFontGreen, "player : ", rooms.player);
        console.log(ConsoleOutput.BgFontGreen, "hand : ", rooms.hand);
        console.log(ConsoleOutput.BgFontGreen, "ACTION : " + _action);
        console.log(ConsoleOutput.BgFontGreen, "_betAmount : " + _betAmount);

        for(var i = 0; i < 9; i++) {
            if (rooms.player[i].userid == undefined) continue;
            console.log(ConsoleOutput.BgFontMagenta, ">>>>>> isaction 0 handleaction");
            rooms.player[i].isaction = 0;
        }

        if (_action == 'CALL' || _action == 'BET' || _action == 'RAISE' || _action == 'ALLIN'){

            if (_action == 'CALL') {
                betamount = (rooms.bet - rooms.player[turn].raise);
                await PlayerActionCall(_io, rooms, _tableId, betamount, turn);
            } else{
                console.log(ConsoleOutput.BgFontGreen, "TYPE : " + _typeAction);
                if (_typeAction == 'BET'){
                    betamount = _betAmount;
                    await PlayerActionBet(_io, rooms, _tableId, betamount, turn);    
                }else {
                    betamount = (rooms.player[turn].credit == _betAmount)? _betAmount : (_betAmount - rooms.player[turn].raise);
                    if(_typeAction == 'ALLIN'){
                        betamount =  rooms.player[turn].credit;
                        await PlayerActionAllin(_io, rooms, _tableId, betamount, turn);
                    } else if (rooms.player[turn].credit > rooms.raise){
                        await PlayerActionRaise(_io, rooms, _tableId, betamount, _betAmount, turn);
                    } else {
                        await PlayerActionAllin(_io, rooms, _tableId, betamount, turn);
                    }   
                }
            }

            // await Secure.PlayerBetting(rooms.player[turn].userid, betamount, rooms.player[turn].credit, Tpk.idgame);
        } else {
            await playerActionCheck(_io, rooms, _tableId, turn);
        }

        if(exports.GetAllStatusAllin(rooms) || rooms.turn == -1){
            rooms.lasthand = rooms.hand;
            // Tpk.StopTimer(rooms);
            exports.SendWinHand(_io, rooms, _tableId);
            console.log("================== Handle Status Allin ==================");
        }else if (exports.GetStatusPlayer(rooms)){
            console.log("================== Handle Status Player ==================");
            if(!rooms.player[rooms.turn].isdone){
                console.log("================== Handle Status Player Next Hand ==================");
                await SendNextHand(_io, rooms, _tableId);
            } else {
                console.log("================== Handle Status Player Win Hand ==================");
                rooms.lasthand = rooms.hand;
                if (rooms.hand < 10){
                    exports.SendWinHand(_io, rooms, _tableId);
                }else{
                    rooms.hand = 11;
                    Tpk.GameState(_tableId, _io, rooms.hand);
                } 
            }
        }else if(exports.ActionPlayerIsDone(rooms)){
            console.log("================== Handle Player Is Done ==================");
            rooms.lastTurn = rooms.turn;
            rooms.hand += 1;
            rooms.bet = 0;
            rooms.lastBet = rooms.bet;
            rooms.raise = rooms.bb;
            
            await NextTurnInNewHand(rooms, _tableId);//ubah
            rooms.lastTurn = rooms.turn;
            Tpk.GameState(_tableId, _io, rooms.hand);  
        }else {
            console.log("================== Handle Next Hand ==================");
            await SendNextHand(_io, rooms, _tableId);
        }
        
        DBCommand.InsertTpkTable(rooms, _tableId);
    }catch(err){
        console.log(ConsoleOutput.ErrorFont, "[ ERROR HANDLE ACTION ]  : " + err);
        QueryGlobal.DumpError(err);
    }
    
}

exports.SendWinHand = async function(_io, _rooms, _tableId){
    console.log(" ============== SEND WIN HAND ===================");
    console.log("==== Table Id ==== : " + _tableId);

    if(_rooms.lasthand < 10){
        await Tpk.Delay(500);
        await exports.GatherAllPlayerBet(_rooms);
        if(_rooms.lasthand < 5){
            await Tpk.SendTableCard(_io, _tableId, 5);
            _rooms.hand = 6;
            _rooms.lasthand = _rooms.hand;
            setTimeout(exports.SendWinHand, 900, _io, _rooms, _tableId);
            return;
        } else if(_rooms.lasthand < 7){
            await Tpk.SendTableCard(_io, _tableId, 7);
            _rooms.hand = 8;
            _rooms.lasthand = _rooms.hand;
            setTimeout(exports.SendWinHand, 300, _io, _rooms, _tableId);
            return;
        } else {
            await Tpk.SendTableCard(_io, _tableId, 9);
            _rooms.hand = 12;
            _rooms.lasthand = _rooms.hand;
            setTimeout(exports.SendWinHand, 300, _io, _rooms, _tableId);
            return;
        }
    }
	//await Tpk.Delay(3000);
    _rooms.hand = 12;
    setTimeout(Tpk.GameState, 500, _tableId, _io, _rooms.hand);
}

exports.PlayerInGame = function(_rooms){
    console.log(" ============== PLAYER IN GAME ===================");
    let playeringame = 0;

    for(let i = 0; i < 9; i++) {
        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay)
            playeringame++;
    }

    return playeringame;
}

exports.PlayerInRoom = async function(_rooms){
    console.log(" ============== PLAYER IN ROOM ===================");
    let playerinroom = 0;

    for(let i = 0; i < 9; i++) {
        if (JSON.stringify(_rooms.player[i]) != "{}")
            playerinroom++;
    }

    return playerinroom;
}

exports.GetAllStatusAllin = function(_rooms){
    console.log(" ============== GET STATUS ALLIN ===================");
    
    let allinCount = 0; playerCount = 0;

    for(let i = 0; i < 9; i++) {
        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay)
            playerCount++;

        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay && _rooms.player[i].credit == 0)
            allinCount++;
        }
        console.log("ALLINCOUNT = " + allinCount);
        console.log("playerCount = " + playerCount);

        if(allinCount == playerCount && allinCount != 0 && playerCount != 0){
            return true;
        } else {
            return false;
        }
}

exports.GetStatusPlayer = function(_rooms){
    console.log(" ============== GET STATUS PLAYER ===================");
    let chipZerro = 0; playerCount = 0;

    for(let i = 0; i < 9; i++) {
        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay)
            playerCount++;

        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay && _rooms.player[i].credit < 1)
            chipZerro++;

        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay && _rooms.player[i].isfold && _rooms.player[i].credit >= 1)
            chipZerro++;

        }

        console.log("chipZerro = " + chipZerro);
        console.log("playerCount = " + playerCount);

        if (playerCount == 1){
            return false;
        } else if((playerCount - chipZerro) < 2){
            return true;
        } else {
            return false;
        }
}

exports.GetAllStatusfold = function(_rooms){
    console.log(" ============== GET STATUS FOLD ===================");
    let foldCount = 0; playerCount = 0;

    for(let i = 0; i < 9; i++) {
        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay)
            playerCount++;

        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay && _rooms.player[i].isfold)
            foldCount++;
    }
    console.log("foldCount = " + foldCount);
    console.log("playerCount = " + playerCount);
    let activeCount = playerCount - foldCount;
    if(activeCount < 2){
        return true;
    } else {
        return false;
    }
}

async function PlayerActionCall(_io,_rooms, _tableId, _betAmount, _turn){
    console.log(ConsoleOutput.BgFontMagenta, "= = = = = = = PLAYER ACTION CALL = = = = = = = = =");
    _rooms.msg = "GAME_PLAYER_GOES_CALL";
    _rooms.pot +=  _betAmount;
    _rooms.player[_turn].bet += _betAmount;
    _rooms.player[_turn].raise += _betAmount;
    _rooms.player[_turn].credit -= _betAmount;
    _rooms.player[_turn].action = 1;
    _rooms.player[_turn].isdone = true;
    _rooms.player[_turn].isaction = 1;
    DBCommand.GameLog(_rooms, _tableId, _turn, "TURN_BET", 1,_betAmount);
    await SendActionPlayer(_io, _rooms.player[_turn], _tableId);
    _rooms.turn = Tpk.GetNextTurn(_tableId);
    console.log("TABEL BET : " + _rooms.bet);
    console.log("TABEL Pot : " + _rooms.pot);
}

async function PlayerActionBet(_io, _rooms, _tableId, _betAmount, _turn){
    console.log(ConsoleOutput.BgFontMagenta, "= = = = = = = PLAYER ACTION BET = = = = = = = = =");
    _rooms.pot +=  _betAmount;
    _rooms.bet =  _betAmount;
    console.log("= credit :" +_rooms.player[_turn].credit + " === _betAmount : " + _betAmount + "LAST BET : " +_rooms.lastBet);
    _rooms.lastBet =_betAmount;
    _rooms.raise = _rooms.lastBet * 2;
    _rooms.lastTurn = _turn;
    _rooms.player[_turn].bet += _betAmount;
    _rooms.player[_turn].raise = _betAmount;
    _rooms.player[_turn].credit -= _betAmount;
    _rooms.player[_turn].action = (_rooms.player[_turn].credit == 0) ? 5 : 4;

    for(p of _rooms.player){
        if(p.credit > 0 && !p.isfold && p.isplay && p.action == 0 ){
            p.isdone = false;
        }
    }

    _rooms.player[_turn].isdone = true;
    _rooms.player[_turn].isaction = 1;
    _rooms.msg = (_rooms.player[_turn].credit == 0) ? "GAME_PLAYER_GOES_ALLIN" : "GAME_PLAYER_GOES_BET";
    DBCommand.GameLog(_rooms, _tableId, _turn, "TURN_BET", 2, _betAmount);
    await SendActionPlayer(_io, _rooms.player[_turn], _tableId);
    _rooms.turn = Tpk.GetNextTurn(_tableId);
    console.log("TABEL BET : " + _rooms.bet);
    console.log("TABEL POT : " + _rooms.pot);
}

async function PlayerActionRaise(_io, _rooms, _tableId, _betamount, _playerBet, _turn){
    console.log(ConsoleOutput.BgFontMagenta, "= = = = = = = PLAYER ACTION RAISE = = = = = = = = =");
    _rooms.pot +=  _betamount;
    _rooms.bet =  (_rooms.lastBet > _playerBet)?_rooms.lastBet:_playerBet;
    console.log("= credit :" +_rooms.player[_turn].credit + " === _betamount : " + _betamount + "LAST BET : " +_rooms.lastBet);
    _rooms.lastBet =  _rooms.bet;
    _rooms.raise = _rooms.lastBet * 2;
    _rooms.lastTurn = _turn;
    _rooms.player[_turn].bet += _betamount;
    _rooms.player[_turn].raise += _betamount;
    _rooms.player[_turn].credit -= _betamount;
    _rooms.player[_turn].action = (_rooms.player[_turn].credit == 0) ? 5 : 2;

    for(p of _rooms.player){
        if(p.credit > 0 && !p.isfold && p.isplay){
            p.isdone = false;
        }
    }

    _rooms.player[_turn].isdone = true;
    _rooms.player[_turn].isaction = 1;
    _rooms.msg = (_rooms.player[_turn].credit == 0) ? "GAME_PLAYER_GOES_ALLIN" : "GAME_PLAYER_GOES_RAISE";
    await SendActionPlayer(_io, _rooms.player[_turn], _tableId);
    DBCommand.GameLog(_rooms, _tableId, _turn, "TURN_BET", 2, _betamount);
    _rooms.turn = Tpk.GetNextTurn(_tableId);
    console.log("TABEL BET : " + _rooms.bet);
    console.log("TABEL POT : " + _rooms.pot);
}

async function PlayerActionAllin(_io, _rooms, _tableId, _betamount, _turn){
    console.log(ConsoleOutput.BgFontMagenta, "= = = = = = = PLAYER ACTION ALLIN = = = = = = = = =");
    _rooms.pot +=  _betamount;
    _rooms.lastTurn = _turn;
    console.log("= credit :" +_rooms.player[_turn].credit + " === _betamount : " + _betamount + "LAST BET : " +_rooms.lastBet);
    _rooms.player[_turn].bet += _betamount;
    _rooms.player[_turn].raise += _betamount;
    _rooms.player[_turn].credit -= _betamount;
    _rooms.player[_turn].action = 5;

    if(_betamount > _rooms.lastBet){
        for(p of _rooms.player){
            if(p.credit > 0 && !p.isfold && p.isplay){
                p.isdone = false;
            }
        }
        _rooms.bet = _betamount
        _rooms.lastBet = _rooms.bet;
    }
    

    _rooms.player[_turn].isdone = true;
    _rooms.player[_turn].isaction = 1;
    _rooms.msg = "GAME_PLAYER_GOES_ALLIN";
    await SendActionPlayer(_io, _rooms.player[_turn], _tableId);
    DBCommand.GameLog(_rooms, _tableId, _turn, "TURN_BET", 2, _betamount);
    _rooms.turn = Tpk.GetNextTurn(_tableId);
    console.log("TABEL BET : " + _rooms.bet);
    console.log("TABEL POT : " + _rooms.pot);
}

async function playerActionCheck(_io, _rooms, _tableId, _turn){
    console.log(ConsoleOutput.BgFontMagenta, "= = = = = = = PLAYER ACTION CHECK = = = = = = = = =");
    _rooms.msg = "GAME_PLAYER_GOES_CHECK";
    _rooms.player[_turn].action = 0;
    _rooms.player[_turn].isdone = true;
    _rooms.player[_turn].isaction = 1;
    _rooms.bet = 0;
    _rooms.lasbet = _rooms.bet;
    DBCommand.GameLog(_rooms, _tableId, _turn, "TURN_BET", 0, 0);
    await SendActionPlayer(_io, _rooms.player[_turn], _tableId);

    _rooms.turn = Tpk.GetNextTurn(_tableId);
}

exports.ActionPlayerIsDone = function(_rooms){
    let turnAccess = 0;
    for(let i = 0; i < 9; i++){
        if (_rooms.player[i].userid !== undefined && !_rooms.player[i].isdone && _rooms.player[i].isplay && !_rooms.player[i].isfold && _rooms.player[i].credit >= 1){
            turnAccess += 1;
            // console.log( "============== ACTION PLAYER IS DONE ===================" , _rooms.player[i]);
        }
    }
    console.log( "============== ACTION PLAYER IS DONE TURN ACCESS ===================" + turnAccess);
    

    if (turnAccess == 0){
        return true;
    }
    return false;

}

async function NextTurnInNewHand(_rooms, _tableId){
    console.log(" ============== NEXT TURN IN NEW HAND ===================");
	let dealerFound = 0;
	_rooms.turn = _rooms.dealer;
	for(let i = 0; i < 9; i++){
		if(JSON.stringify(_rooms.player[i]) == "{}") continue;
		if(_rooms.player[i].seatid == _rooms.turn && _rooms.player[i].credit > 1 && !_rooms.player[i].isfold && _rooms.player[i].isplay){
			dealerFound += 1;
		}
	}
	if(dealerFound == 0){
		_rooms.turn = Tpk.GetNextTurn(_tableId); 
	}
}

async function SendNextHand(_io, _rooms, _tableid){
    console.log(" ============== SEND NEXT HAND ===================");
    if(_rooms.player[_rooms.turn].credit < 1){
        _rooms.turn = Tpk.GetNextTurn(_tableid);
    }
    SendDataStateGame(_io, _rooms, _tableid)
}

function CekDealerTurn (_rooms, _tableId){
    console.log(" ============== CEK DEALER TURN ===================");
    if(_rooms.dealer == undefined){
        if(_rooms.turn == -1)_rooms.turn=Tpk.GetNextTurn(_tableId);

        if(_rooms.player[_rooms.turn].userid !== undefined){
            _rooms.dealer = _rooms.turn;
            return _rooms.dealer;
        }else {
            _rooms.dealer = Tpk.GetNextTurn(_tableId);
            return _rooms.dealer;
        }
    }else {
        _rooms.dealer = Tpk.GetNextDealer(_tableId);
        return _rooms.dealer;
    }
    console.log(ConsoleOutput.BgFontCyan, "DEALER 1: " + _rooms.dealer);
}

async function AllFoldSetWinner (_io, _rooms, _tableId){
    console.log(" ============== ALL FOLD SET WINNER ===================");
    console.log(" ============== Player : ", _rooms.player);
    let i_win = -1;
    for(let i = 0; i < 9; i++) {
        if (JSON.stringify(_rooms.player[i]) != "{}" && _rooms.player[i].isplay && !_rooms.player[i].isfold && !_rooms.player[i].isstand) {
            _rooms.player[i].win = _rooms.pot;
            _rooms.player[i].typewin = "WINNER";
            i_win = i ;
        }
    }

    _rooms.msg = 'GAME_MSG_ALLFOLD';
    console.log("========================= FOLD WOY : " +  _rooms.hand);
    console.log("========================= i_win : " +  i_win);
    if(_rooms.hand > 3 && _rooms.hand < 11){
        _rooms.isallfold = true;
        _rooms.hand = 13;
        if(i_win != -1){await exports.SetWinArrayFold(_rooms, i_win);}
        console.log("======== Win Bet Array : ", _rooms.winBetArray);
        Tpk.GameState(_tableId, _io, _rooms.hand);
    }

}

exports.SetWinArrayFold = async function(_rooms, _i_win){
    try{
        await exports.GatherAllPlayerBet(_rooms);
        for (Spreadbetplayer of _rooms.spreadPot){
            _rooms.winBetArray.push({'uids':[_rooms.player[_i_win].userid], 'totalBet': Spreadbetplayer["totalBet"]});
        }
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, "[ ERROR SET WIN ARRAY FOLD ]  : MSG ==>" + error);
        QueryGlobal.DumpError(error);
    }
}

exports.GatherAllPlayerBet = async function(_rooms){
    console.log(ConsoleOutput.BgFontWhite, '======================= GatherAllPlayerBet ======================');
    try {
        bets = [];
        console.log(ConsoleOutput.BgFontWhite, '> Players  roomlist ', _rooms.player);
        for (player of _rooms.player.filter(p => p.isfold === false && p.isplay === true)) {
            console.log(ConsoleOutput.BgFontWhite, '> Players  ', player);
            if (bets.indexOf(player.bet) < 0)
                bets.push(player.bet);
        }
        
        bets = bets.sort((b1, b2) => b1 > b2 ? 1 : -1);
        console.log(ConsoleOutput.BgFontWhite, '=============================================');
        console.log(ConsoleOutput.BgFontWhite, '> bets ', bets);
        // console.log(`bet_distinct:${JSON.stringify(bets)}`);

        this.totalBetArray = [];
        let ctotalBet = 0;

        let playerBets = [];
            for (player of _rooms.player.filter(p => p.bet > 0)) {
                playerBets.push({
                    uid: player.userid,
                    username: player.name,
                    totalBet: player.bet,
                });
            }
            for (player of _rooms.playersPendingUpdate.filter(p => p.bet > 0)) {
                playerBets.push({
                    uid: player.userid,
                    username: player.name,
                    totalBet: player.bet,
                });
            }
            console.log(ConsoleOutput.BgFontWhite, '> Player Bets  ', playerBets);
        for (let x = 0; x < bets.length; x++) {
            console.log(ConsoleOutput.BgFontWhite, '> bets x ' + x + ' >>> ', bets);
            let betData = {
                uids: [],
                usernames: [],
                totalBet: 0,
            }
            for (player of _rooms.player.filter(p => p.isfold === false && p.bet >= bets[x])) {
                betData.uids.push(player.userid);
                betData.usernames.push(player.name);
            }

            /*if(x==0)
                betData.totalBet=betData.uids.length*bets[x];
            else
                betData.totalBet+=betData.uids.length*(bets[x]-bets[x-1]);*/
            
            for (playerBet of playerBets) {
                if (playerBet.totalBet <= 0) continue;

                if (x === 0) {
                    if (playerBet.totalBet >= bets[x]) {
                        betData.totalBet += bets[x];
                        playerBet.totalBet -= bets[x];
                    } else {
                        betData.totalBet += playerBet.totalBet;
                        playerBet.totalBet = 0;
                    }
                } else {
                    if (playerBet.totalBet >= (bets[x] - bets[x - 1])) {
                        betData.totalBet += (bets[x] - bets[x - 1]);
                        playerBet.totalBet -= (bets[x] - bets[x - 1]);
                    } else {
                        betData.totalBet += playerBet.totalBet;
                        playerBet.totalBet = 0;
                    }
                }
            }
            console.log(ConsoleOutput.BgFontWhite, '> bet Data ', betData);
            ctotalBet += betData.totalBet;
            this.totalBetArray.push(betData);
        }
        if (this.totalBet > ctotalBet)
            this.totalBetArray[0].totalBet += this.totalBet - ctotalBet;

        _rooms.spreadPot = this.totalBetArray;
        console.log(`total_bet_array:${JSON.stringify(this.totalBetArray)}`);
        console.log(ConsoleOutput.BgFontWhite, '=============================================');
    } catch (error) {
        console.log(ConsoleOutput.ErrorFont, '..catch_error: gather_all_player_bet_2');
        QueryGlobal.DumpError(error);
    }
};


// ============================================== Region Send To Client ==========================================
async function SendActionPlayer (_io, _players, _tableId){
    try{
        console.log("===== Send action player BET : " + _players.action);
        console.log("===== Send action player RAISE : " + _players.raise);
        let param = {};
        param["playerdata"] = {
            userid : parseInt(_players.userid),
            seatid : parseInt(_players.seatid),
            action : parseInt(_players.action),
            raise :  parseFloat(_players.raise),
            credit : parseFloat(_players.credit)
        }
        
        Tpk.BroadcastEmit(_io, _tableId, 'player_action_sender', param);
        // _io.to(Tpk.GetTableName(_tableId)).emit('player_action_sender', param);
        console.log(ConsoleOutput.FontYellow, "================== SEND ACTION PLAYER ==================");
        console.log("PARAM", param);
    }catch(err){
        console.log(ConsoleOutput.ErrorFont, "PLAYER SEND DATA ACTION ERROR  : " + err.message);
        QueryGlobal.DumpError(err);
    }
}

function SendDataStateGame(_io, _rooms, _tableId){
    try{
        let param = {};
        param["dataTable"] = {
            hand: _rooms.hand,
            turn: _rooms.turn,
            bet: parseFloat(_rooms.bet),
            pot: parseFloat(_rooms.pot),
            raise: parseFloat(_rooms.raise),
            actplayer : parseInt(_rooms.active_player)
        }

        Tpk.BroadcastEmit(_io, _tableId, 'turnaction_sender', param);
        // _io.to(Tpk.GetTableName(_tableId)).emit('turnaction_sender', param);
        setTimeout(Tpk.TurnTimeout, 500, _io, _rooms, _tableId);
        // Tpk.TurnTimeout(_io, _rooms, _tableid);
        console.log(ConsoleOutput.FontYellow, "================== SEND DATA STATE GAME ==================");
        console.log("PARAM", param)
    }catch(err){
        console.log(ConsoleOutput.ErrorFont, "PLAYER SEND DATA STATE ERROR  : " + err.message);
        QueryGlobal.DumpError(err);
    }
}


//#region  help function
exports.TranslateAction = async function(_action){
    try{
        let action = ["check", "call", "rise", "fold", "bet", "allin", "bigblind", "smallblind"];

        if(action[_action] != undefined){
            return action[_action];
        }else{
            return "";
        }

    }catch(error){
        console.log(ConsoleOutput.ErrorFont, "Translate   : " + error.message);
        QueryGlobal.DumpError(error);
    }
    

}
//#endregion

//0 : Check, 1 : Call, 2 : rise, 3 : Fold, 4 : Bet, 5 : Allin, 6 : BB, 7: SB