const ConsoleOutput = require('../../app/casino_menu/console_output');
const QueryGlobal = require('../global/global_query.js');
const Tpk = require('./poker');
const BetPoker = require('./bet-poker');
const Secure = require('../casino_menu/secure');
const FuncGlobal = require('../../include/func-global.js');
const fs = require('fs');
// const util = require('util');

exports.PlayerInDB=async function(_cek){ // true = cek, false = delete; 
    try {
        if(_cek){
            let rows = await sql.query('SELECT user_id, chip, table_id total_bet FROM tpk_player');
            return rows;
        } else{
            await sql.query(`TRUNCATE TABLE tpk_player;`);
        }
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, '[ ERROR PLAYER IN DB AREA ] MSG ==> ', error.message);
        QueryGlobal.DumpError(error)
        throw Error(error.message);
    }
    
}

exports.TableData=async function(_alltable){ //true == find all table, false == just one table 
    try{
        let rows;
        if(_alltable == -1){
            rows = await sql.query('SELECT t.table_id, t.room_id, t.round_id, t.name as nametable, t.max_player, t.turn, t.small_blind, t.big_blind, t.min_buy, t.max_buy, t.timer, t.jackpot FROM tpk_table t LEFT JOIN tpk_room r ON t.room_id = r.room_id');
            return rows;
        }else{
            rows = await sql.query('SELECT t.table_id, t.room_id, t.round_id, t.name as nametable, t.max_player, t.turn, t.small_blind, t.big_blind, t.min_buy, t.max_buy, t.timer, t.jackpot FROM tpk_table t LEFT JOIN tpk_room r ON t.room_id = r.room_id WHERE t.table_id = ?', [_alltable]);
            if(rows.length == 0) throw Error("[ SYNC DATA ] => Table Not Found");
            return rows;
        }
        
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, '[ ERROR DATA TABLE AREA ] MSG ==> ', error.message);
        QueryGlobal.DumpError(error)
        throw Error(error.message);
    }
}

// exports.CekPlayerStatus=async function(_userid){ //udah global
//     try{
//         console.log("[ === AREA CEK BANNED PLAYER === ]", _userid);
//         let rows = await sql.query('SELECT status FROM user Where user_id = ?', [_userid]);
        
//         if(rows.length > 0){
// 			if(rows[0].status != 1){
// 				return rows[0].status;
// 			}else {
//                 return true;
//             }
// 		}else {
// 			throw Error('USER NOT FOUND');
// 		}
//     }catch(error){
//         console.log(ConsoleOutput.ErrorFont, '[ ERROR BANNED PLAYER AREA ] MSG ==> ', error.message);
//         QueryGlobal.DumpError(error)
//         throw Error(error.message);
//     }
// }

exports.PlayerJoinGame = async function(_userid, _tableid, _sit, _playerbuyin){
    try{
        await sql.query('INSERT INTO tpk_player SET ?', { user_id: _userid, table_id: _tableid, seat_id: _sit, chip: _playerbuyin});
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, '[ ERROR PLAYER JOIN ] MSG ==> ', error.message);
        QueryGlobal.DumpError(error)
        throw Error(error.message);
    }
}

// exports.UpdateLastGame = async function(_idgame, _userid){ //udah global
//     try{
//         await sql.query('UPDATE user SET last_game = ? WHERE user_id = ?', [_idgame, _userid]);
//     }catch(error){
//         console.log(ConsoleOutput.ErrorFont, '[ ERROR LAST GAME ] MSG ==> ', error.message);
//         QueryGlobal.DumpError(error)
//         throw Error(error.message);
//     }
// }

exports.AddRoundStat = async function (_tableid) {
    console.log(ConsoleOutput.BgFontYellow, "= = = = = = =  ADD ROUND STAT = = = = = = = = =");
    try {
        let roundid =await sql.query('INSERT INTO tpk_round SET ?', {table_id: _tableid, date: new Date()});
        return roundid.insertId;
    }
    catch (error) {
        console.log(ConsoleOutput.ErrorFont, '[ ERROR ADD ROUND ] MSG ==> ', error.message);
        QueryGlobal.DumpError(error)
        throw Error(error.message);
    }
}

exports.UpdatePlayerChip = async function (_chip, _userid) {
    try {
        await sql.query(`UPDATE tpk_player SET chip = ${_chip} WHERE user_id = ${_userid}`);
    }
    catch (error) {
        console.log(ConsoleOutput.ErrorFont, '..catch_error: update_player_state' + error.message);
        QueryGlobal.DumpError(error);
    }
}

exports.RemovePlayer=async function(tableid, uid, seatid){
    try{
        console.log(ConsoleOutput.BgFontYellow, "= = = = = = = REMOVE PLAYER = = = = = = = = =" + uid );

        await sql.query(`DELETE FROM tpk_player WHERE table_id=${tableid} AND user_id=${uid} AND seat_id=${seatid};`);
    }
    catch(error){
        console.log(ConsoleOutput.ErrorFont, '..catch_error: Remove Player' + error.message);
        QueryGlobal.DumpError(error);
    }
}

exports.StartRoundLog =async function(_rooms, _tableid){
    try{
        let str_log = '{"game_state":"NEW_ROUND","round_id":'+_rooms.roundid+',"hand":'+_rooms.hand;
        str_log += ',"pot":'+_rooms.pot+',"cardtable":"","player":[';
        let str_temp = str_log;

        for(var a = 0; a < 9; a++){
            if (_rooms.player[a].userid){
                if(str_log == str_temp) str_log += '{';
                else str_log += ',{';
                str_log += '"seat_id":' + a; // {"user_id":}
                str_log += ',"user_id":' + _rooms.player[a].userid; // {"user_id":}
                str_log += ',"bet":' + _rooms.player[a].bet; // {"user_id":}
                str_log += ',"totalbet":' + _rooms.player[a].bet; // {"user_id":}
                str_log += ',"action":"' + await BetPoker.TranslateAction(_rooms.player[a].action) + '"'; // {"user_id":}
                str_log += ',"chip":' + _rooms.player[a].credit;
                str_log += ',"card":"' + _rooms.player[a].hands + '"'; // {"hands":}
                str_log += '}';
    
                sql.query('UPDATE tpk_player SET chip = ?, action = ?, isplay = ?, total_bet = ? WHERE user_id = ?', [_rooms.player[a].credit,2, _rooms.player[a].isplay, _rooms.player[a].bet, _rooms.player[a].userid]);
            }

            if(_rooms.player[a].userid !== undefined){
                _rooms.player[a].roundgame += 1
            }

        }

        str_log += ']}';
        _rooms.gamelog = str_log;

        sql.query('UPDATE tpk_table SET ? WHERE ?', [{
            round_id: _rooms.roundid,
            turn:_rooms.turn,
            total_pot:_rooms.pot,
            bet_array:'-'},{table_id: _tableid}]);

    }catch(error){
        console.log(ConsoleOutput.ErrorFont, '..catch_error: update start round' + error.message);
        QueryGlobal.DumpError(error);
    }
}

exports.GameLog = async function(rooms, tableid, sit, type, action, amount){
    try{
        console.log(ConsoleOutput.BgFontYellow, "= = = = = = = GAME LOG = = = = = = = = =" + rooms.hand);
        console.log(ConsoleOutput.BgFontYellow, "= = = = = = = GAME LOG = = = = = = = = =" + rooms);
        if(rooms.player[sit].hasOwnProperty('userid')){
            let str_log = '\n{"game_state":"'+type+'","hand":'+rooms.hand+',"pot":'+rooms.pot+',"cardtable":"'+rooms.cardTable+'","player":[';
            str_log += '{';
            str_log += '"seat_id":' + sit;
            str_log += ',"user_id":' + rooms.player[sit].userid;
            str_log += ',"bet":' + amount;
            str_log += ',"totalbet":' + rooms.player[sit].bet;
            str_log += ',"action":"' + await BetPoker.TranslateAction(rooms.player[sit].action)+ '"';
            str_log += ',"chip":' + rooms.player[sit].credit;
            str_log += ',"card":"' + rooms.player[sit].hands + '"';
            str_log += ',"typecard":"' + rooms.player[sit].typecard + '"';
            str_log += ',"defaultcard":"' + rooms.player[sit].card1 +','+ rooms.player[sit].card2 +'"';
            str_log += '}]}';

            rooms.gamelog += str_log; 
            await sql.query('UPDATE tpk_player SET action = ?,hand = ?, chip = ? ,total_bet = ? WHERE user_id = ?', [action,
                rooms.player[sit].card1.toString() + "," + rooms.player[sit].card2.toString(),
                rooms.player[sit].credit, rooms.player[sit].bet, rooms.player[sit].userid]);
        }
        
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, '..catch_error: Game Log' + error.message);
        QueryGlobal.DumpError(error);
    }
}

exports.InsertTpkTable = async function(rooms, tableid){
    console.log(ConsoleOutput.BgFontYellow, "= = = = = = = Insert Tpk Table = = = = = = = = =" + rooms.hand);
    try{
        await sql.query('UPDATE tpk_table SET ? WHERE ?', [{
    		turn:rooms.turn,
            total_pot:rooms.pot,
            jackpot:rooms.jackpot,
    		bet_array:(rooms.spreadPot.length == 0) ? '-': TotalBetArrayToString(rooms.spreadPot)},{table_id: tableid}]);
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, '..catch_error: Insert Tpk Table');
        console.log(ConsoleOutput.ErrorFont, '.....'+error.message);
    }

}

exports.PlayerActivePlay =async function(player){
    try{
        console.log(ConsoleOutput.BgFontYellow, "= = = = = = = PLAYER ACTIVE PLAY = = = = = = = = =");
        await sql.query('UPDATE tpk_player SET isplay = ?,action = ?,hand = ?, chip = ?, total_bet = ? WHERE user_id = ?', [player.isplay, null, "", player.credit, player.bet, player.userid]);
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, '..catch_error: player Actif play');
        console.log(ConsoleOutput.ErrorFont, '.....'+error.message);
    }
}

exports.GetConfig = async function(rooms){
    console.log(ConsoleOutput.BgFontYellow, "[ ==== GET CONFIG FEE AREA ==== ]");
    try {
        const tpk_config = await sql.query('SELECT name, value FROM tpk_config');

        // rooms.bet_fee = tpk_config.filter(p=> (p.name === "bet_fee")).map(p => p.value);
        rooms.bet_fee = tpk_config.find(p=> (p.name === "bet_fee")).value; 
        rooms.bet_point = tpk_config.find(p=> (p.name === "bet_point")).value; 
        rooms.win_exp = tpk_config.find(p=> (p.name === "win_exp")).value; 
        rooms.lose_exp = tpk_config.find(p=> (p.name === "lose_exp")).value; 
        rooms.jackpot_fee = tpk_config.find(p=> (p.name === "jp_fee")).value; 
        rooms.royal_flush = tpk_config.find(p=> (p.name === "jp_royal_flush")).value; 
        rooms.straight_flush = tpk_config.find(p=> (p.name === "jp_straight_flush")).value; 
        rooms.four_of_a_kind = tpk_config.find(p=> (p.name === "jp_four_kind")).value; 
        rooms.fullhouse = tpk_config.find(p=> (p.name === "jp_fullhouse")).value; 
        rooms.flush = tpk_config.find(p=> (p.name === "jp_flush")).value; 
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR GET CONFIG FEE AREA ==== ] MSG ==> " + error.message);
    }
}

exports.InsertQueryWin =async function(_io, _rooms, _tableid){
        try{
            console.log(ConsoleOutput.BgFontYellow, "[ ==== INSERT QUERY WIN AREA ====]");
            // await exports.GetConfig(_rooms);

            for(player of _rooms.player){
                if(player.userid == undefined) continue;
                if(player.bet == 0) continue;

                await Secure.PlayerBetting(player.userid, player.bet, player.credit, Tpk.idgame);
                
                const win_amount = player.win;
               
                player.credit -= player.win;

                const bet = player.bet;
                const total_fee = bet*_rooms.bet_fee;
                const total_point = total_fee*_rooms.bet_point;
                const total_win = Math.floor(win_amount - (win_amount*_rooms.bet_fee));
                _rooms.jackpot += total_fee * _rooms.jackpot_fee;

                console.log("[ INSERT QUERY WIN AREA ] UID ==> " + player.userid);
                await sql.query('UPDATE user_stat SET point = point + ? WHERE user_id = ?', [total_point, player.userid]);

                const lose = (bet - win_amount) < 0 ? 0 : (bet - win_amount);
                const status = (win_amount > 0) ? 2:3;
                const total_exp = (status == 2) ? bet * _rooms.win_exp : bet * _rooms.lose_exp;
				let wintype = 0; //lose
                const winLose = total_win - bet;
                player.credit += total_win;
                player.win = total_win;

                if (player.typewin == "SIDE" || player.typewin == "SPLIT"){
                    wintype = 2; //draw
                } else if (player.typewin == "WINNER"){
                    wintype = 1; // single win
                }

                console.log("type > " +player.typewin + "wintype"+wintype+ ", Lose : " + lose + ", status " + status + ", total EXP : " + total_exp + ", totalwin : " + total_win + ", total_point : " +total_point+", winLose : " + winLose);

                await exports.UpdatePlayerRound(_rooms.roundid, player, bet, winLose, wintype);

                await QueryGlobal.InsertPlayerTransactionDay(Tpk.idgame, player.userid, bet, (winLose < 0) ? 0 : winLose , lose, total_fee, 0);
                await QueryGlobal.InsertPlayerPointDay(player.userid, total_point);
                console.log("[ === POINT ROUND === ] UID ==> " + player.userid);    
                console.log("[ === POINT ROUND === ] total point ==> " + total_point);    
                // await Secure.PointRound(player.userid, total_point, 101);
                let levelup = await Secure.GainExpPointRound(player.userid, total_exp, total_point, (status == 2) ? true : false, Tpk.idgame);

                if (status == 2) {
                    await Secure.PlayerWin(player.userid, total_win, player.credit, Tpk.idgame);
                } else {
                    await Secure.PlayerLose(player.userid, lose, player.credit, Tpk.idgame);
                }

                if(levelup.isLeveledUp) {
                    player.islevelup = true;
                    console.log("[PLAYER LEVEL UP IN INSERT QUERY WIN] : " + levelup.level);
                    player.level = levelup.level;
                }

            }
            console.log(" [INSERT QUERY WIN AREA ] ==> ROOMS END PHASE ", _rooms);
            exports.InsertTpkTable(_rooms, _tableid);
            exports.PlayerWinLog(_rooms, _tableid);
            setTimeout(Tpk.GameState,2000, _tableid, _io, _rooms.hand+1);
        }catch(error){
            console.log(ConsoleOutput.ErrorFont, '[ ERROR INSERT QUERY WIN AREA ] MSG ==> ', error.message);
            console.log(ConsoleOutput.ErrorFont, '.....'+QueryGlobal.DumpError(error));
        }
    }

exports.KickPlayer =async function(_io, _tableid, _roomlist, _kick_player){
    console.log(ConsoleOutput.BgFontYellow, "[ ==== KICK PLAYER AREA ==== ] kick_player ==>", _kick_player);
    console.log(ConsoleOutput.BgFontYellow, "[ KICK PLAYER ] PLAYER == > ", _roomlist[_tableid].player);
    try {
        let playerKick = [];

        if(_kick_player != 0){
            playerKick.push(_kick_player);
        }

        let rooms = _roomlist[_tableid];
        let foldCount = 0; playerCount = 0;
        let param;

        for(let i = 0; i < 9; i++) {
            if(JSON.stringify(rooms.player[i]) == "{}") continue;
               
            playerCount++;

            if (rooms.player[i].credit < 1 || rooms.player[i].isstand ||rooms.player[i].isdisconnect){
                playerKick.push(rooms.player[i]);
                foldCount++;
            }
        }

        let activeCount = playerCount - foldCount;
        rooms.active_player = activeCount;

        for(player of playerKick){
            if (player.userid == undefined) continue;
                 
            let players = rooms.player;
            for(let x in players){
                if(players[x].userid == undefined) continue;

                let uid = players[x].userid;
                if(players[x].userid == player.userid && player.autobuyin != -1){

                    var valueJoin = {
                        uid : player.userid,
                        tableId : _tableid,
                        buyin : rooms.minBuy,
                        sessionId : player.sessionid,
                        userKey : player.userkey,
                        seat : player.seatid,
                        autoBuyin : player.autobuyin
                    }

                    try{
                        await Tpk.Auto_Buyin(_tableid, x, _io);
						activeCount++;
						rooms.active_player = activeCount;
                    }catch(e){
                        rooms.sit[x] = 0;
                        players.splice(x, 1, {});
                        await Secure.UpdateUserChipAfterGame(player.userid, player.credit, 101);
                        if(player.isdisconnect){
                            await Secure.ExitRoom(player.userid);
                        }
                        await exports.RemovePlayer(_tableid, player.userid, player.seatid);  
                        rooms.active_player = await FuncGlobal.countPlay(rooms.sit);
                        activeCount = rooms.active_player;
                        io.to(Tpk.GetTableName(_tableid)).emit('player_stand', {userid : player.userid});
                    }
                } else {
                    exports.SaveErrorLog('>> DATA KiKC PLAYER', 'ROUND ID : '+ rooms.roundid, 'playerKick : { uid: '+player.userid+", name: "+player.name+", credit: "+player.credit+", afkcounter: "+player.afkcounter+", isstand: "+player.isstand+", isdisconnect: " +player.isdisconnect+'}');
                    if(rooms.sit[x] == player.userid){
                        rooms.sit[x] = 0;
                        rooms.active_player = await FuncGlobal.countPlay(rooms.sit);
                        activeCount = rooms.active_player;      
                    }
                    if(players[x].userid == player.userid){
                        players.splice(x, 1, {});
                        await Secure.UpdateUserChipAfterGame(player.userid, player.credit, 101);
                        if(player.isdisconnect){
                            await Secure.ExitRoom(player.userid);
                        }
                    }
				
                    console.log("Player Stand Remove database 3 player : ", player.userid);
                    if(uid == player.userid){
                        console.log("Player Stand Remove database 4 : ", players);
                        await exports.RemovePlayer(_tableid, player.userid, player.seatid);
                        _io.to(Tpk.GetTableName(_tableid)).emit('player_stand', {userid : player.userid});
                    }
                }      
            }
        }

        console.log(" IN KICK PLAYER 1: ", rooms.playersPendingUpdate);

        for(player of rooms.playersPendingUpdate){
            if(player.bet == 0) continue;
                const bet = player.bet;
                const total_win = Math.floor(player.win - (player.win*rooms.bet_fee));
                const winLose = total_win - bet;
                const lose = (bet - total_win) < 0 ? 0 : (bet - total_win);
                const total_exp = bet * rooms.lose_exp;
                const total_fee = bet*rooms.bet_fee;
                const total_point = total_fee*rooms.bet_fee;
                rooms.jackpot += total_fee * rooms.jackpot_fee;

                await exports.UpdatePlayerRound(rooms.roundid, player, bet, winLose, 0);
                await QueryGlobal.InsertPlayerTransactionDay(Tpk.idgame, player.userid, bet, (winLose < 0)?0:winLose, lose, total_fee, 0);
                await QueryGlobal.InsertPlayerPointDay(player.userid, total_point);
                let levelup = await Secure.GainExpPointRound(player.userid, total_exp, total_point, false, Tpk.idgame);
                if(levelup.isLeveledUp){
                    player.islevelup = true;
                    console.log("INI LEVEL UP GASGHJAGSJHAGS : " + levelup.level);
                    player.level = levelup.level;
                }
				
			if(player.win == 0) continue; //cek balikin uang keplayer jika player stand bersamaan
				console.log("[ KICK PLAYER IN WIN ] PLAYER == > ", player);
                // player.credit += total_win;
                // await Secure.UpdateUserChipAfterGame(player.userid, player.credit, 101);
                await Secure.UpdateUserChipAfterGame(player.userid, total_win, 101);
        }
        await Tpk.LevelupPlayer(_io, rooms);
        
        rooms.playersPendingUpdate=[];
        console.log(" IN KICK PLAYER 2: ", rooms.playersPendingUpdate);
        console.log(" ACTIVE COUNTS Room : ", rooms.active_player);
        console.log(" ACTIVE COUNTS GLOBAL : ", await FuncGlobal.countPlay(rooms.sit));
        console.log(" ACTIVE COUNTS 1 : ", activeCount);
        activeCount = await FuncGlobal.countPlay(rooms.sit);
        console.log(" ACTIVE COUNTS 2 : ", activeCount);
        if (activeCount < 2){
            rooms.status=0;
            rooms.turn == -1;
            sql.query('UPDATE tpk_table SET turn = -1 WHERE table_id = ?', [_tableid]);
            return;
        }else {;
            setTimeout(Tpk.GameState,2000, _tableid, _io, rooms.hand);
        }
    } catch(error){
        console.log(ConsoleOutput.ErrorFont, '[ ERROR KICK PLAYER ] MESSAGE ==> ' +error.message);
        console.log(ConsoleOutput.ErrorFont, '.....'+QueryGlobal.DumpError(error));
    }
}

exports.PlayerWinLog = function(rooms, tableid){
    try {
        console.log(ConsoleOutput.BgFontYellow, "= = = = = = = PLAYER WIN LOG = = = = = = = = =");
        let str_log = '\n{"game_state":"END_ROUND","hand":'+rooms.hand+',"pot":'+rooms.pot+',"cardtable":"'+rooms.cardTable+'","player":[';
        var count = 0;
            for(var a = 0; a < 9; a++){
                if (rooms.player[a].userid){
                    if(count > 0) str_log += ',';
                    
                    let winlose = (rooms.player[a].win > 0) ? "WIN" : "LOSE";
					
                    str_log += '{';
                    str_log += '"seat_id":' + a;
                    str_log += ',"user_id":' + rooms.player[a].userid;
                    str_log += ',"totalbet":' + rooms.player[a].bet;
                    str_log += ',"action":"' + rooms.player[a].action+ '"';
                    str_log += ',"chip":' + rooms.player[a].credit;
                    str_log += ',"win":' + rooms.player[a].win;
                    str_log += ',"status":"'+winlose+'"';
                    str_log += ',"card":"' + rooms.player[a].hands + '"';
                    str_log += ',"typecard":"' + rooms.player[a].typecard + '"';
                    str_log += ',"defaultcard":"' + rooms.player[a].card1 +','+ rooms.player[a].card2 +'"';
                    str_log += ',"typewin":"' + rooms.player[a].typewin +'"';
                    str_log += ',"valuecard":"' + rooms.player[a].valuecard +'"';
                    str_log += '}';
                    sql.query('UPDATE tpk_player SET  chip = ? WHERE user_id = ?', [rooms.player[a].credit,rooms.player[a].userid]);
                    count++;
                }
            }
            str_log += ']}';

            rooms.gamelog += str_log;
            sql.query(`UPDATE tpk_round SET gameplay_log = '${rooms.gamelog}' WHERE table_id= ${tableid} AND round_id=${rooms.roundid}`); 
    }catch(error){
        console.log(ConsoleOutput.ErrorFont, '..catch_error: player win log');
        console.log(ConsoleOutput.ErrorFont, '.....'+error.message);
    }

}

exports.SetBalanceChip =async function(userid, actionid, debit, credit, total, gameid){
	try{
	    console.log(ConsoleOutput.BgFontYellow, "= = = = = = = BALANCE CHIP = = = = = = = = =");
        let chip_total = total;
		if(chip_total == -1){
			let rows = await sql.query(`SELECT chip FROM user_stat WHERE user_id = ${userid}`);
			chip_total = rows[0].chip;
		}
		await sql.query	('INSERT INTO balance_chip SET ?, datetime = NOW()', { user_id: userid, action_id: actionid, debit: debit, credit: credit, balance: chip_total, game_id: gameid});
	}catch(error){
        console.log(ConsoleOutput.ErrorFont, '..catch_error: Balance Chip');
        console.log(ConsoleOutput.ErrorFont, '.....'+error.message);
	}
}

exports.SetBalancePoint =async function(userid, actionid, debit, credit, total, gameid){
	try{
        console.log(ConsoleOutput.BgFontYellow, "= = = = = = = BALANCE Point = = = = = = = = =");
		let point_total = total;
		if(point_total == -1){
			let rows = await sql.query(`SELECT point FROM user_stat WHERE user_id = ${userid}`);
			point_total = rows[0].point;
		}
		await sql.query('INSERT INTO balance_point SET ?', { user_id: userid, action_id: actionid, debit: debit, credit: credit, balance: point_total, game_id: gameid });
	}catch(error){
        console.log(ConsoleOutput.ErrorFont, '..catch_error: Balance Point');
        console.log(ConsoleOutput.ErrorFont, '.....'+error.message);
	}
}

exports.UpdatePlayerRound= async function(_roundid, _player, _bet, _winLose, _wintype){
   console.log("[ ==== UPDATE PLAYER ROUND AREA ==== ]");
   try{
        await sql.query('INSERT INTO tpk_round_player SET ?', {
            round_id: _roundid,
            user_id: _player.userid,
            seat_id: _player.seatid,
            bet: _bet,
            win_lose: _winLose,
            status:_wintype, 
            hand_card:ArrayToString(_player.hands) 
        });
   } catch(error){
    console.log("[ ERROR UPDATE PLAYER ROUND AREA ] ==> MSG : " + error.message);
   }
}


exports.Login = async function (_username, _password) {
    try {
      let qry = `SELECT op_id, userpass from operator WHERE username = '${_username}' LIMIT 1`;
      let result = await sql.query(qry);
  
      if (result.length == 0)
        throw Error('No Operator Found.');
  
    //   let checkPass = await FuncGlobal.DecryptCompare(_password, result[0].userpass);
  
    //   if (checkPass) {
        let data = {
          isLoggedIn: true,
          isError: false,
          errorMsg: '',
          uid: result[0].op_id,
          username: _username
        }
        return data;
    //   } else {
        // let data = {
        //   isLoggedIn: false,
        //   isError: true,
        //   errorMsg: 'Wrong Password',
        //   uid: null,
        //   username: ''
        // }
        // return data;
    //   }
    } catch (error) {
      console.log(ConsoleOutput.ErrorFont, '...catch_error: login');
      QueryGlobal.DumpError(error);
    }
  }

exports.SaveErrorLog = function (_roundid, _msg, _desc) {
    try {
        let today = new Date();
        let date = today.getDate() + '-' + (today.getMonth() + 1) + '-' + today.getFullYear();
        if (!fs.existsSync(`./logs`)) fs.mkdirSync(`./logs`);
        if (!fs.existsSync(`./logs/poker`)) fs.mkdirSync(`./logs/poker`);
        // if (!fs.existsSync(`./logs/poker/${date}.txt`)) fs.mkdirSync(`./logs/poker/${date}.txt`);
        
        fs.appendFile(`./logs/poker/${date}.txt`, `${_roundid}\r\n${_msg}\r\n${_desc}\r\n\r\n`, function (err) {
            if (err) console.log(ConsoleOutput.ErrorFont, err.message);
            else console.log(ConsoleOutput.BgFontGreen, 'ERROR_SAVED');
        });
    } catch (error) {
        console.log(ConsoleOutput.ErrorFont, '..catch_error: save_error_log');
        QueryGlobal.DumpError(error);
    }
}

function ArrayToString(_array){
	let str = "";
	for(let index_b = 0; index_b < _array.length; index_b++){
		if(str != "") str += ",";
		str += _array[index_b];
	}
	if(str == "") str = "";
	return str;
}

function TotalBetArrayToString(_totalBetArray) {
    if (_totalBetArray.length == 0)
      return '-';

    let str = '(';
    for (let b = 0; b < _totalBetArray.length; b++) {
      str += '(uids=(';
      for (let u = 0; u < _totalBetArray[b].uids.length; u++) {
        str += _totalBetArray[b].uids[u].toString();
        if (u < (_totalBetArray[b].uids.length - 1))
          str += ',';
      }
      str += '),total_bet=';
      str += _totalBetArray[b].totalBet.toString();
      str += ')';
      if (b < (_totalBetArray.length - 1))
        str += ',';
    }
    str += ')';
    return str;
  };


