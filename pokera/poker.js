const FuncGlobal = require('../../include/func-global.js');
const DeckCard = require('./deck');
const BetPoker = require('./bet-poker');
const DBCommand = require('./db_command');
const ConsoleOutput = require('../casino_menu/console_output');
const Lobby = require('./../casino_menu/lobby');
const QueryGlobal = require('../global/global_query.js');
const Secure = require('../casino_menu/secure');
const Room = require('./room');
// const util = require('util');

const roomlist = {};
const gamecode = 'TPK';
exports.idgame = 101;

exports.rooms = roomlist;

var startConnection = false;

exports.Start = async function (){
	try{
		console.log(ConsoleOutput.BgFontYellow, "[ ==== SOCKET START ==== ]");

		// CEK PLAYER IN DB
		let playerInDb = await DBCommand.PlayerInDB(true);
		for (pid of playerInDb) {
			console.log("[ SOCKET START ] ==> PLAYER IN DB");
			let uid = pid.user_id;
			let debit = pid.chip + pid.total_bet;
	
			console.log(ConsoleOutput.FontYellow, `uid:${pid.user_id} chip_on_game:${debit} total_bet:${pid.total_bet}`);
			await Secure.UpdateUserChipAfterGame(uid, debit, 'TPK');
			await Secure.ExitRoom(uid);
		}

		await DBCommand.PlayerInDB(false);
		console.log("[ SOCKET START ] ==> PLAYER NOT IN DB");

		// PREPARE ROOM
		let rows = await DBCommand.TableData(-1);
		for(let i_table = 0; i_table < rows.length; i_table++){
			let tableid = rows[i_table].table_id;
		
			roomlist[tableid] = new Room.Roomlist(
				tableid, 
				rows[i_table].room_id, 
				rows[i_table].round_id, 
				rows[i_table].nametable, 
				rows[i_table].max_player, 
				rows[i_table].turn,  
				rows[i_table].small_blind, 
				rows[i_table].big_blind, 
				rows[i_table].min_buy, 
				rows[i_table].max_buy, 
				rows[i_table].timer, 
				rows[i_table].jackpot,
			);

			await DBCommand.GetConfig(roomlist[tableid]);
			for (let i_player = 0; i_player < 9; i_player++) {
				roomlist[tableid].sit[i_player] = 0;
				roomlist[tableid].player[i_player] = {};
			}
			console.log("[ SOCKET START ] TABLE ID IN ROOM LIST ==> ", tableid);
		}
		// console.log("[ SOCKET START ] ROOM IN ROOM LIST ==>" , roomlist[10]);
		startConnection = true;
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR SOCKET START ==== ]");
        console.log(ConsoleOutput.ErrorFont, "[ ERROR SOCKET START ] MSG ==> ", error.message);
		QueryGlobal.DumpError(error);
	}
}
	
exports.DataSync = async function (_socket, _io, _data) {
	try {
		console.log(ConsoleOutput.BgFontYellow, "[ ==== DATA ASYNC ==== ]");
		console.log("[ DATA ASYNC ] DATA ==> ", _data);
		console.log("[ DATA ASYNC ] S.User ==> ", _socket.user);

		if(startConnection == false){ //jika restart server tunggu server selesai load id meja
			setTimeout(exports.DataSync, 100, _socket, _io, _data);
			return;
		}

		let rows;
		let tableid = _socket.user.tableid;
		let param;
		let tablename;
		let islocal = false;
		
		if(!roomlist[tableid]){

			rows = await DBCommand.TableData(tableid);

			roomlist[tableid] = new Room.Roomlist(
				tableid, 
				rows[0].room_id, 
				rows[0].round_id, 
				rows[0].nametable, 
				rows[0].max_player, 
				rows[0].turn,  
				rows[0].small_blind, 
				rows[0].big_blind, 
				rows[0].min_buy, 
				rows[0].max_buy, 
				rows[0].timer,
				rows[0].jackpot,
			);

			for (let i_player = 0; i_player < 9; i_player++) {
				roomlist[rows[0].table_id].sit[i_player] = 0;
				roomlist[rows[0].table_id].player[i_player] = {};
			}
		} 

		let _stringdata = JSON.stringify(_data); //untuk log, nanti hapus
		DBCommand.SaveErrorLog('>> DATA SYNC', 'DATA FROM PLAYER : '+ _stringdata, 'ROOMLIST : ' + exports.RoomsToString(roomlist[tableid]));
			
		for (let c in roomlist[tableid].player) {
			if(roomlist[tableid].player[c] == "{}") continue;
			if(roomlist[tableid].player[c].userid != _socket.user.userid) continue;

			roomlist[tableid].player[c].userkey = _data.userkey;
			roomlist[tableid].player[c].sessionid = _data.sessionid; 
			roomlist[tableid].player[c].socketid = _socket.id; 
			roomlist[tableid].player[c].isdisconnect = false

			if(roomlist[tableid].player[c].isplay){
				islocal = true;
			}
		}
		
		//}

		// cek user has been banned
		console.log("cek admin ====== ", _socket.user);
		if(!_socket.user.admin){
			console.log("huawa");
			if (await exports.GetBanned(_socket.user.userid, -1, tableid, _io, _socket.id)) return;
		}
	
		tablename = exports.GetTableName(tableid);
		_socket.join(tablename, async function () {
			if(roomlist[tableid].active_player < 2 && roomlist[tableid].hand >=2 ){roomlist[tableid].hand = 1;}// jika table tidak tersetting

			// Region Timer
			let timeEnd = new Date().getTime();
			let diff = timeEnd - roomlist[tableid].timeStart;
			roomlist[tableid].onTurnTimerElapse = roomlist[tableid].turntimer - (diff / 1000);

			await Secure.JoinRoom(_data.userid, 101, tableid);

			roomlist[tableid].active_player = await FuncGlobal.countPlay(roomlist[tableid].sit)
			param = await exports.DataParam(tableid);
			console.log("[ DATA SYNC ] PARAM ==> ", param);
			_socket.emit("sync_sender", param);

			if(roomlist[tableid].hand >=3 && islocal){
				console.log("REconnec >>>>> ");
				await SendReconnectPlayerCard(_socket, tableid);
			}

			if(roomlist[tableid].hand > 4 && roomlist[tableid].hand <= 6 ){
				await exports.SyncCardTable(_socket, tableid, 5);
			}else if (roomlist[tableid].hand > 6 && roomlist[tableid].hand <= 8){   
				await exports.SyncCardTable(_socket, tableid, 5);
				await exports.Delay(1400);
				await exports.SyncCardTable(_socket, tableid, 7);
			} else if (roomlist[tableid].hand > 8 && roomlist[tableid].hand <= 14 && !roomlist[tableid].isallfold){
				await exports.SyncCardTable(_socket, tableid, 5);
				await exports.Delay(1400);
				await exports.SyncCardTable(_socket, tableid, 7);
				await exports.SyncCardTable(_socket, tableid, 9);
			}
		});
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR DATA SYNC ==== ]");
        console.log(ConsoleOutput.ErrorFont, "[ ERROR DATA SYNC ] MSG ==> ", error.message);
		QueryGlobal.DumpError(error);
	}
}

exports.JoinTable = async function (_socket, _io, _data) {
	console.log(ConsoleOutput.BgFontYellow, "[ ==== JOIN TABLE ==== ]" , _data);
	console.log("[ JOIN TABLE ] DATA ==> " , _data);
	console.log("[ JOIN TABLE ] S.User ==> " , _socket.user);

	let tableid = _socket.user.tableid;
	let player_buyin = parseFloat(_data.buyin);
	let tablename = exports.GetTableName(tableid);
	let sit = -1;

	try {

		if(await exports.GetBanned(_socket.user.userid, -1, tableid, _io, _socket.id)) return;

		let min_buy = roomlist[tableid].minBuy;
		let chip_player = await Lobby.GetUserChip(_socket.user.userid);

		if(player_buyin < min_buy ||chip_player < player_buyin){
			console.log(ConsoleOutput.ErrorFont, "[ JOIN TABLE ] ==> Not Enough Chip");
			let param = {msg: "FAIL_CHIP", type:"join"};
			_socket.emit('fail_data', param);
			return;
		}
		
		if (_data.seat != -1){ //jika player pilih kursi
			if(roomlist[tableid].sit[_data.seat] == 0){ //jika kursi yang dipilih masih kosong
				sit = _data.seat;
			}else{
				sit = await GetSit(tableid); 
			}
		} else {
			sit = await GetSit(tableid);
		}

		if (sit > -1) { // jika ada kursi 
			_socket.join(tablename, async function () {
				try{
					roomlist[tableid].sit[sit] = _socket.user.userid;
					await Secure.BuyInGame2(_socket.user.userid, player_buyin, 101);
					await DBCommand.PlayerJoinGame(_socket.user.userid, tableid, sit, player_buyin);
					await Secure.UpdatePlayerLastGame(_socket.user.userid, exports.idgame);
					// await DBCommand.UpdateLastGame(exports.idgame, _socket.user.userid);
	
					roomlist[tableid].player[sit] = new Room.Player(
						_socket.user.sessionid,
						_socket.user.userkey,
						_socket.user.userid, 
						_socket.user.avatar,
						_socket.id, 
						_socket.user.username,
						sit,
						player_buyin,
						false,
						(_data.autoBuyin != "0")?player_buyin:-1
					)
					console.log("======== GET JOIN GAME : ", roomlist[tableid].player[sit]);
					var param = {};
					param.playerlist = [];
					param.mysit = sit;
					param.myid = _socket.user.userid.toString();
					param.currentchip = parseFloat(chip_player-player_buyin);
					
					for (let i_sit = 0; i_sit < roomlist[tableid].player.length; i_sit++) {
						if (roomlist[tableid].sit[i_sit] == 0) continue;
						if (!roomlist[tableid].player[i_sit].name) continue;
						param.playerlist[i_sit] = {};
						param.playerlist[i_sit].playerseat = i_sit;
						param.playerlist[i_sit].playerid = roomlist[tableid].player[i_sit].userid;
						param.playerlist[i_sit].name = roomlist[tableid].player[i_sit].name;
						param.playerlist[i_sit].credit = roomlist[tableid].player[i_sit].credit;
						param.playerlist[i_sit].avatar = roomlist[tableid].player[i_sit].avatar;
					}
					_socket.emit('playerjoin_sender', param);

					var param2 = {};
					param2.playerlist = [];

					param2.playerlist[sit] = {};
					param2.playerlist[sit].playerseat = sit;
					param2.playerlist[sit].playerid = roomlist[tableid].player[sit].userid;
					param2.playerlist[sit].name = roomlist[tableid].player[sit].name;
					param2.playerlist[sit].credit = roomlist[tableid].player[sit].credit;
					param2.playerlist[sit].avatar = roomlist[tableid].player[sit].avatar;
					param2.playerlist = param2.playerlist.filter(x => x);
					_socket.to(tablename).emit('playerjoin_sender', param2);


					var sitTotal = await BetPoker.PlayerInRoom(roomlist[tableid]); // Number of player have sit
					roomlist[tableid].active_player = sitTotal;
					
					if (sitTotal == 1) roomlist[tableid].turn = -1;
					DBCommand.SaveErrorLog('>> DATA JOIN GAME PLAYER PLAY', 'STATUS TABLE AND TABLEID : ' + roomlist[tableid].status + " AND " + roomlist[tableid].id, 'USER AND ROUND : '+ _socket.user.userid + " And " +roomlist[tableid].roundid);
					if (roomlist[tableid].status == 0 && sitTotal > 1){
						roomlist[tableid].status = 1;
						roomlist[tableid].onprepare = 1;
						for (var i = 0; i < 9; i++){
							if(JSON.stringify(roomlist[tableid].player[i]) == "{}") continue;
							roomlist[tableid].player[i].isplay = true;
						}

						exports.GameState(tableid, _io, 1);
					}
				}catch(error){
					let param = {msg:"FAIL_DATA", type:"join"};
					_socket.emit('fail_data', param);
					for(let x=0; x< 9 ; x++){
			            if(roomlist[tableid].sit[x] == _socket.user.userid){
			                roomlist[tableid].sit[x] = 0;
			            }
			        }
				}
			});
		} else {
			let param = {msg:"FULL", type:"join"};
			_socket.emit('fail_data', param);
			return;
		}
	} catch (error) {
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR JOIN TABLE ==== ]");
        console.log(ConsoleOutput.ErrorFont, "[ ERROR JAOIN TABLE  ] MSG ==> ", error.message);
		QueryGlobal.DumpError(error);
	}
}

exports.Auto_Buyin = async function (_tableId, _sit, _io){
	console.log(ConsoleOutput.BgFontYellow, "[ ==== AUTO BUYIN AREA ==== ]");

	try{
		let currentrooms = exports.FindRoom(_tableId);
		if(_sit < 0) throw Error("Seat not found");
		
		const userid = currentrooms.sit[_sit];
		
		let chip_player = await Lobby.GetUserChip(userid);

		let chip_total_stat = chip_player + currentrooms.player[_sit].credit;
		chip_total_stat = (chip_total_stat - currentrooms.minBuy).toFixed(2);

		if(chip_total_stat < 0){
			_io.to(currentrooms.player[_sit].socketid).emit('fail_data', {msg: "FAIL_CHIP", type:"join"});
			throw Error("FAIL_CHIP");
		} 

		currentrooms.player[_sit].credit = currentrooms.player[_sit].autobuyin;

		await Secure.BuyInGame2(userid, currentrooms.player[_sit].autobuyin, exports.idgame);
		await DBCommand.UpdatePlayerChip(currentrooms.player[_sit].credit, userid);
		
		_io.to(currentrooms.player[_sit].socketid).emit('player_autobuyin', {
			sit : parseInt(currentrooms.player[_sit].seatid), 
			uid : parseInt(currentrooms.player[_sit].userid), 
			credit: parseFloat(currentrooms.player[_sit].credit)});

	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR AUTO BUYIN ==== ]");
        console.log(ConsoleOutput.ErrorFont, "[ ERROR AUTO BUYIN ] MSG ==> ", error.message);
		QueryGlobal.DumpError(error);
		throw error;
	}
}

exports.GameState = async function(_tableId, _io, _hand) {
	try{
		let param = {};
		roomlist[_tableId].hand = _hand;

		switch(roomlist[_tableId].hand) { //gamestate
			case 1:
				DBCommand.SaveErrorLog('>> DATA STATE 1 GAME', 'ACTIVE PLAYER && STATUS: '+ roomlist[_tableId].active_player +' AND '+roomlist[_tableId].status, 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));
				if(roomlist[_tableId].active_player < 2){roomlist[_tableId].status = 0; return;}
				roomlist[_tableId].isallfold = false;
				roomlist[_tableId].status = 1;
				roomlist[_tableId].playersPendingUpdate=[];

				console.log(ConsoleOutput.BgFontYellow, "[ ==== STATEMENT 1 ==== ]");

				for(player of roomlist[_tableId].player){
					if(player.userid == undefined) continue;
					if(roomlist[_tableId].onprepare &&  roomlist[_tableId].onprepare == 1 && !player.isplay) continue;
					if(await exports.GetBanned(player.userid, player.seatid, _tableId, _io, player.socketid)) continue;
					if(roomlist[_tableId].active_player < 2){setTimeout(exports.GameState,2000, _tableId, _io, 1); return;}
					console.log(" === BANNED NOH ==== act " + roomlist[_tableId].active_player);
					player.isplay = true;
					DBCommand.PlayerActivePlay(player);

					if(await Secure.IsUserChipValidOnGame(player.userid, player.credit, 101) != true){
							DBCommand.SaveErrorLog('>> DATA START GAME VALIDATION ERROR', 'ROUND ID : '+ roomlist[_tableId].roundid, 'UID : ' + player.userid);
							console.log("[ STATEMENT 1 ]  CREDIT  ==> "+player.credit);
							console.log("[ STATEMENT 1 ]  validation no error ==> "+await Secure.IsUserChipValidOnGame(player.userid, player.credit, 101));
							DBCommand.SaveErrorLog('>> PLAYER STAND', 'DATA FROM STATEMENT : '+ player.userid, 'PLAYER STAND DATA FROM S1 VALIDATION ERROR');
						await exports.PlayerStand(_io, player.userid, player.seatid, _tableId);
						
							console.log("[ STATEMENT 1 ] ROUNDID ==> "+roomlist[_tableId].roundid);
							console.log("[ STATEMENT 1 ] active_player ==> "+roomlist[_tableId].active_player);
						
						if(roomlist[_tableId].active_player < 2){	
							exports.CleanRoom(_tableId);
							roomlist[_tableId].status = 0;
							DBCommand.SaveErrorLog('>> GAME STATE 1', 'ROUND ID : '+ roomlist[_tableId].roundid, 'CLEAN DATA FROM S1 VALIDATION ERROR ==> STATUS : ' + roomlist[_tableId].status);
							return;
						}
					}


				}

				roomlist[_tableId].roundid = await DBCommand.AddRoundStat(_tableId);
				roomlist[_tableId].lasthand = roomlist[_tableId].hand;

				DBCommand.SaveErrorLog('>> DATA START GAME', 'ROUND ID : '+ roomlist[_tableId].roundid, 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));

				param["dataTable"]= {hand: parseInt(roomlist[_tableId].hand), 
									 actplayer: parseInt(roomlist[_tableId].active_player), 
									 sb: parseFloat(roomlist[_tableId].sb), 
									 bb: parseFloat(roomlist[_tableId].bb), 
									 roundid: parseInt(roomlist[_tableId].roundid)};
					
				exports.BroadcastEmit(_io, _tableId, 'roundstart_sender', param);					 
				// _io.to(exports.GetTableName(_tableId)).emit('roundstart_sender', param);
				setTimeout(exports.GameState,2000, _tableId, _io, _hand+1);
				break;
			case 2: // set dealer, bet big & small
				DBCommand.SaveErrorLog('>> DATA STATE2 GAME', 'ACTIVE PLAYER && STATUS: '+ roomlist[_tableId].active_player +' AND '+roomlist[_tableId].status, 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));
				if(roomlist[_tableId].active_player < 2){roomlist[_tableId].status = 0; exports.CleanRoom(_tableId);  return;}
				console.log(ConsoleOutput.BgFontYellow, "[ ==== STATEMENT 2 ==== ]");
				roomlist[_tableId].lasthand = roomlist[_tableId].hand;
				BetPoker.StartRound(_tableId, _io, roomlist);
				break;
			case 3: //setcard
				console.log(ConsoleOutput.BgFontYellow, "[ ==== STATEMENT 3 ==== ]");
				DBCommand.InsertTpkTable(roomlist[_tableId], _tableId);
				await DealCard(_tableId, _io);

				if (BetPoker.GetAllStatusfold(roomlist[_tableId])){
					exports.StopTimer(roomlist[_tableId]);
					let i_win;
					for (player of roomlist[_tableId].player){
						if(player.userid != undefined && player.isplay && !player.isfold){
							i_win = player.seatid;
						}
					}

					await BetPoker.SetWinArrayFold(roomlist[_tableId], i_win);
					_hand = 13 ;
					console.log("[ STATEMENT 3 ] ==> CATCH STOP ACTION");
					exports.GameState(_tableId, _io, _hand);
					return;
				}

				let cekInplay=0;

				for(player of roomlist[_tableId].player){
					if(player.userid == undefined || !player.isplay || player.isfold) continue;
					cekInplay++;
				}

				roomlist[_tableId].lasthand = roomlist[_tableId].hand;
				setTimeout(exports.GameState,700*cekInplay, _tableId, _io, _hand+1);
				break;
			case 4: case 5: case 6: case 7: case 8: case 9: case 10: // acion bet and action card
				console.log(ConsoleOutput.BgFontYellow, "[ ==== STATEMENT "+roomlist[_tableId].hand+" ==== ]");
				if (BetPoker.GetStatusPlayer(roomlist[_tableId]) || BetPoker.GetAllStatusfold(roomlist[_tableId])){
					if(BetPoker.GetStatusPlayer(roomlist[_tableId])){
						roomlist[_tableId].lasthand = _hand;
						BetPoker.SendWinHand(_io, roomlist[_tableId], _tableId);
						return;
					} else {
						_hand = 13 ;
						roomlist[_tableId].lasthand = roomlist[_tableId].hand;
						exports.GameState(_tableId, _io, _hand);
						exports.StopTimer(roomlist[_tableId]);
						return;
					}	
				}

				if(roomlist[_tableId].hand == 4){
					for(player of roomlist[_tableId].player){
						if(player.isstand){
							await exports.PlayerStand(_io, player.userid, player.seatid, _tableId);
						}
					}
				} 

				if (roomlist[_tableId].hand == 5 || roomlist[_tableId].hand == 7 || roomlist[_tableId].hand == 9){
					exports.StopTimer(roomlist[_tableId]);
					await BetPoker.GatherAllPlayerBet(roomlist[_tableId]);
					await exports.SendTableCard(_io, _tableId, roomlist[_tableId].hand);
					
					setTimeout(exports.GameState,2000, _tableId, _io, _hand+1);
				}else {
					DBCommand.InsertTpkTable(roomlist[_tableId], _tableId);

					for (let i = 0; i < 9; i++){ // set bet every player 0 for next call/raise
						if(roomlist[_tableId].player[i].userid == undefined) continue;
						if(_hand != 4){
							roomlist[_tableId].player[i].raise = 0;
							roomlist[_tableId].player[i].isdone = false;
						}
							roomlist[_tableId].player[i].action = -1;;
							roomlist[_tableId].player[i].isaction= 0;
					}

					await ParamDataTurn(_io, _tableId, _hand);
					setTimeout(exports.TurnTimeout, 50, _io, roomlist[_tableId], _tableId);
				}
				break;
			case 11:
				if(roomlist[_tableId].active_player < 2){roomlist[_tableId].status = 0; return;}
				console.log(ConsoleOutput.BgFontYellow, "[ ==== STATEMENT 11 ==== ]");
				exports.StopTimer(roomlist[_tableId]);
				await BetPoker.GatherAllPlayerBet(roomlist[_tableId]);
				DBCommand.InsertTpkTable(roomlist[_tableId], _tableId);
				roomlist[_tableId].lasthand = roomlist[_tableId].hand;
				exports.GotoTurnHand(_tableId, _io, _hand);
				break;
			case 12:
				DBCommand.SaveErrorLog('>> DATA STATE 12 GAME', 'Status && ACTIVE PLAYER: '+ roomlist[_tableId].active_player +' AND '+roomlist[_tableId].status, 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));
				console.log(ConsoleOutput.BgFontYellow, "[ ==== STATEMENT 12 ==== ]");
				
				exports.StopTimer(roomlist[_tableId]);

				await BetPoker.GatherAllPlayerBet(roomlist[_tableId]);
				await FindWinner(_tableId);

				await ParamDataTurn(_io, _tableId, _hand);
				roomlist[_tableId].lasthand = roomlist[_tableId].hand;
				setTimeout(exports.GameState,2000, _tableId, _io, _hand+1);
				exports.CleanActionPlayer(_tableId);
				break;
			case 13:
				DBCommand.SaveErrorLog('>> DATA STATE 13 GAME', 'Status && ACTIVE PLAYER: '+ roomlist[_tableId].active_player +' AND '+roomlist[_tableId].status, 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));
				console.log(ConsoleOutput.BgFontYellow, "[ ==== STATEMENT 13 ==== ]");

				for(let i = 0; i < 9; i++){
					if(JSON.stringify(roomlist[_tableId].player[i]) === "{}") continue;
					if(roomlist[_tableId].player[i].win == 0) continue;
					roomlist[_tableId].player[i].credit += Math.floor(roomlist[_tableId].player[i].win);
				}
				exports.StopTimer(roomlist[_tableId]);
				await ParamDataTurn(_io, _tableId, _hand);
				await DBCommand.InsertQueryWin(_io, roomlist[_tableId], _tableId);
				exports.CleanActionPlayer(_tableId);
				break;
			case 14:
				console.log(ConsoleOutput.BgFontYellow, "[ ==== STATEMENT 14 ==== ]");
				
				await ParamDataTurn(_io, _tableId, _hand);
				await exports.GetJackpot(roomlist[_tableId], _io, _tableId);
				await exports.CleanRoom(_tableId);
				console.log("[ ==== STATEMENT 14 ==== ] ==> HAS CLEAN");
				DBCommand.KickPlayer(_io, _tableId, roomlist, 0);
				DBCommand.InsertTpkTable(roomlist[_tableId], _tableId);
				exports.CleanActionPlayer(_tableId);
				DBCommand.SaveErrorLog('>> DATA STATE 14 GAME', 'Status && ACTIVE PLAYER: '+ roomlist[_tableId].active_player +' AND '+roomlist[_tableId].status, 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));
				break;
		}
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR TURN HAND ==== ]");
        console.log(ConsoleOutput.ErrorFont, "[ ERROR TURN HAND  ] MSG ==> ", error.message);
		QueryGlobal.DumpError(error);
		throw Error(error);
	}
}

async function DealCard(_tableId, _io) {
	try{
		// let deckcard = DeckCard.Deal(roomlist[_tableId].active_player, roomlist[_tableId].roundid);
		let deckcard = DeckCard.Deal(roomlist[_tableId].active_player);
		let i_c=1;
		for(let i_sit = 0; i_sit < 9; i_sit++){
			if (roomlist[_tableId].player[i_sit].userid == undefined || !roomlist[_tableId].player[i_sit].isplay || roomlist[_tableId].player[i_sit].isfold1) continue;

			roomlist[_tableId].player[i_sit].card1 = deckcard['p'+(i_c)+'card1'];
			roomlist[_tableId].player[i_sit].card2 = deckcard['p'+(i_c)+'card2'];
			roomlist[_tableId].player[i_sit].hands = [deckcard['p'+(i_c)+'card1'], deckcard['p'+(i_c)+'card2']];
			sql.query('UPDATE tpk_player SET hand = ? WHERE user_id = ?', [roomlist[_tableId].player[i_sit].hands.toString(), roomlist[_tableId].player[i_sit].userid]);
			i_c += 1;
		}
		roomlist[_tableId].cardTable[0] = deckcard['card1'];
		roomlist[_tableId].cardTable[1] = deckcard['card2'];
		roomlist[_tableId].cardTable[2] = deckcard['card3'];
		roomlist[_tableId].cardTable[3] = deckcard['card4'];
		roomlist[_tableId].cardTable[4] = deckcard['card5'];

		await SendPlayerCard(_io, _tableId);

		sql.query('UPDATE tpk_table SET ? WHERE ?', [{card_table: roomlist[_tableId].cardTable.toString()},{table_id: _tableId}]);
	}catch (error){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR DEAL CARD ==== ]");
        console.log(ConsoleOutput.ErrorFont, "[ ERROR DEAL CARD ] MSG ==> ", error.message);
		QueryGlobal.DumpError(error);
	}
}

exports.SetAutoplay = function(_io, _userid, _tableId){
	let player = roomlist[_tableId].player.find(p=>(p.userid==_userid));

	if(player==undefined){
		throw Error('[ERROR] player_object_not_found');
	}
		
	DBCommand.SaveErrorLog('>> DATA SET AUTO PLAY', 'DATA FROM PLAYER : {uid: '+player.userid+", name: "+player.name+", seat: "+player.seatid+", isfold: "+player.isfold+", isplay: "+player.isplay+", afkcounter: "+ player.afkcounter+"}", 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));			
	player.afkcounter=0;
	player.isautoplay=!player.isautoplay;

	if(player.isautoplay){
		if(roomlist[_tableId].turn===player.seatid)
			if(roomlist[_tableId].hand >3 && roomlist[_tableId].hand < 11){
				exports.StartAutoPlay(_io, _tableId, player.seatid, _userid, 50);
			}
	}
	else if(roomlist[_tableId].autoplaythread!==undefined){
		StopAutoPlay(_tableId);
	}
							
	return player.isautoplay;
}

exports.StartAutoPlay = function(_io, _tableId, _seatid, _userid, _delay){
	try {
		roomlist[_tableId].autoplaythread =setTimeout(async () => {
			try {;
				if(_seatid!==roomlist[_tableId].turn)
						throw Error('player_auto_play: not_this_player_turn');
				
				let player = roomlist[_tableId].player.find(p=>p.seatid===_seatid);
				DBCommand.SaveErrorLog('>> DATA START AUTO PLAY', 'DATA FROM PLAYER : {uid: '+player.userid+", name: "+player.name+", seat: "+_seatid+", isfold: "+player.isfold+", isplay: "+player.isplay+", afkcounter: "+ player.afkcounter+"}", 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));
				if(player===undefined)
					throw Error('player_auto_play_not_found');
				if(player.isfold)
					throw Error('player_auto_play_is_fold');
				if(player.credit<=0)
					throw Error('player_auto_play_dont_have_chip');
				
				if(roomlist[_tableId].bet != 0 || player.isdisconnect){
					BetPoker.FoldAction(_io, _tableId, roomlist, _seatid, false);
				} else {
					BetPoker.HandleAction(_io, _tableId, "CHECK", "", 0, roomlist, _userid);
				}	
			}catch(e){
				console.log(ConsoleOutput.ErrorFont, e.message);
				QueryGlobal.DumpError(e);
			}
		}, _delay);
	}catch(e){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR START AUTO PLAY ==== ]");
        console.log(ConsoleOutput.ErrorFont, "[ ERROR START AUTO PLAY ] MSG ==> ", e.message);
		QueryGlobal.DumpError(e);
	}
	
}

function StopAutoPlay(_tableId){
	if(roomlist[_tableId].autoplaythread!==undefined){
		clearTimeout(roomlist[_tableId].autoplaythread);
		roomlist[_tableId].autoplaythread=undefined;
	}
}

exports.GetTableName = function(_tableId) {
	return gamecode + '' + _tableId;
}

exports.CleanActionPlayer = function(_tableId) {
	for (let i = 0; i < 9; i++){ // set bet every player 0 for next call/raise
		if(roomlist[_tableId].player[i].userid == undefined) continue;
		roomlist[_tableId].player[i].isaction = 0;
	}
}

exports.GotoTurnHand = async function(_tableId, _io, _hand) {
	await ParamDataTurn(_io, _tableId, _hand);
	setTimeout(exports.GameState,2000, _tableId, _io, _hand+1);
	exports.CleanActionPlayer(_tableId);
}

exports.TurnTimeout = function (_io, _rooms, _tableId){// Turn Time when no one move
	try {
		console.log(ConsoleOutput.BgFontYellow, "==== [TURN TIMEOUT AREA] ==== : TURN ==> " + _rooms.turn);

		const data = {};
		const action = {};

		action.action = "FOLD";
		data.tableid = _tableId;
		data.userid = _rooms.sit[_rooms.turn];

		clearTimeout(_rooms.timer);
		_rooms.timer=null

		exports.Delay(10);
		console.log("[TURN TIMEOUT AREA]: PLAYER ==>", _rooms.player);
		if((JSON.stringify(_rooms.player[_rooms.turn]) == "{}")) throw Error("Player Not Found In Function TurnTimeout");
		if(_rooms.player[_rooms.turn].hasOwnProperty('isautoplay')){
			console.log("==== TURN TIMEOUT : ", _rooms.player[_rooms.turn]);
			if(_rooms.player[_rooms.turn].isautoplay == true || _rooms.player[_rooms.turn].isdisconnect && !_rooms.player[_rooms.turn].isfold){
				exports.StartAutoPlay(_io, _tableId, _rooms.turn, data.userid, 750);
			}
		}

		_rooms.timeStart = new Date().getTime();
		_rooms.timer = setTimeout(async () =>{  // Delay turnAction call
			let player = _rooms.player.find(p=>p.seatid==_rooms.turn);
			if(player != undefined){
				if(player.afkcounter >= 2){
					DBCommand.SaveErrorLog('>> PLAYER STAND', 'DATA FROM PLAYER : '+ data.uid, 'PLAYER STAND DATA FROM AFK ');
					exports.PlayerStand(_io, data.userid, _rooms.turn, _tableId);
				} else {
					player.afkcounter += 1;
					exports.TurnAction(data, _io, action, true);
				}	
			}
			
		}, (_rooms.turntimer * 1000));
	}catch (err){
		console.log(ConsoleOutput.ErrorFont, "[ERROR TURN TIMEOUT] : " + err);
		QueryGlobal.DumpError(err);
	}
}

exports.StopTimer = function(_rooms){
	if(_rooms.timer!=null){
            clearTimeout(_rooms.timer);
			_rooms.timer=null;
			_rooms.timeStart = 0;
        }
}

exports.TurnAction = async function (_socket,_io, _data, _isApk) { // Every turn will run this method
	try{
		console.log(ConsoleOutput.BgFontYellow, "[ ==== TURN ACTION ==== ]");
		let hand = roomlist[_socket.tableid].hand;
		let player = roomlist[_socket.tableid].player.find(p=>(p.userid==_socket.userid));

		if(player == undefined) {throw Error('Player Not Found');}
		if(_socket.userid != roomlist[_socket.tableid].player[roomlist[_socket.tableid].turn].userid) {throw Error('Player Not Same');}
		if (!_isApk){player.afkcounter = 0;}
		
		
		if(hand == 5 || hand == 7 || hand == 9){
			roomlist[_socket.tableid].hand += 1
		}

		if (_data.action == "FOLD"){
			let sitPlayer = player.seatid;
			BetPoker.FoldAction(_io, _socket.tableid, roomlist, sitPlayer, false);
		} else{
			// setTimeout(BetPoker.HandleAction, 50, _io, _data.tableId, _data.action, _data.typeAction, _data.betAmount, roomlist, _data.uid);
			exports.StopTimer(roomlist[_socket.tableid]);
			BetPoker.HandleAction(_io, _socket.tableid, _data.action, _data.typeAction, _data.betAmount, roomlist, _socket.userid);
		}
	}catch (err){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR TURN ACTION ==== ] : " + err.message);
		QueryGlobal.DumpError(err);
	}
	
}

exports.GetNextTurn = function (_tableId) {
	var nextturn = roomlist[_tableId].turn + 1;
	for (var i = 0; i < 9; i++) {
		if (nextturn >= 9) nextturn = 0;

		if (roomlist[_tableId].player[nextturn] !== undefined) {
			if (roomlist[_tableId].sit[nextturn] != 0 && roomlist[_tableId].player[nextturn].isplay && !roomlist[_tableId].player[nextturn].isfold && roomlist[_tableId].player[nextturn].credit >= 1) {
				return nextturn;
			}
		}
		nextturn++;
	}
	return -1;
}

exports.GetNextDealer = function (_tableId) {
	var nextturn = roomlist[_tableId].dealer + 1;
	for (var i = 0; i < 9; i++) {
		if (nextturn >= 9) nextturn = 0;
		
		if (roomlist[_tableId].player[nextturn] !== undefined) {		
			if (roomlist[_tableId].sit[nextturn] != 0 && roomlist[_tableId].player[nextturn].isplay && !roomlist[_tableId].player[nextturn].isfold) {
				return nextturn;
			}
		}
		nextturn++;
	}
	return -1;
}

exports.LevelupPlayer = async function(_io, _rooms){
	for (player of _rooms.player){
		if(player.islevelup){
			console.log(ConsoleOutput.BgFontYellow, `player uid : ${player.userid} LEVELED UP!`);
			_io.to(player.socketid).emit('level_up', {msg: "You Level UP", levelup: true, level :player.level});
			player.islevelup = false;
		}
	}
	

	for(playerupdate of _rooms.playersPendingUpdate){
	 	if(playerupdate.islevelup){
			console.log(ConsoleOutput.BgFontYellow, `player uid : ${player.userid} LEVELED UP!`);
			_io.to(playerupdate.socketid).emit('level_up', {msg: "You Level UP", levelup: true});
			playerupdate.islevelup = false;
		 }
	}
	
}

exports.CekJackpot = async function(_cekjpt){
	if (_cekjpt == "Royal Flush"){
		return 0;
	} else if (_cekjpt == "Straight Flush"){
		return 1;
	} else if (_cekjpt == "Four of a Kind"){
		return 2;
	} else if (_cekjpt == "Fullhouse"){
		return 3;
	} else if (_cekjpt == "Flush"){
		return 4;
	} else{
		return -1;
	}
}

exports.PlayerStand = async function(_io, _uid, _sit, _tableid){
	try{
		console.log(ConsoleOutput.BgFontYellow, "[ ==== PLAYER STAND ==== ]");
		console.log("[ PLAYER STAND ] UID ==> " + _uid + ", SIT ==> " + _sit + ", tableid ==> ", _tableid);
		let players = (roomlist[_tableid].player);
		let player=players.find(p=>(p.userid==_uid));
		
		if(player==undefined){ throw Error;}

		console.log("[ PLAYER STAND ] HAND ==> " + roomlist[_tableid].hand);
		console.log("[ PLAYER STAND ] IS DONE ==> " + BetPoker.ActionPlayerIsDone(roomlist[_tableid]));

		DBCommand.SaveErrorLog('>> DATA PLAYER STAND', 'DATA FROM PLAYER : {uid: '+player.userid+", name: "+player.name+", seat: "+_sit+", isfold: "+player.isfold+", isplay: "+player.isplay+", afkcounter: "+ player.afkcounter+", isautoplay: "+player.isautoplay+"}", 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableid]));

		if(roomlist[_tableid].hand >=2 && roomlist[_tableid].hand < 4 || roomlist[_tableid].hand >= 12 && player.userid == _uid && player.isplay
			|| roomlist[_tableid].hand == 11 && BetPoker.ActionPlayerIsDone && player.userid == _uid && player.isplay){
				
			roomlist[_tableid].player[_sit].isstand = true;
			return;
		}

		if(player.isplay && !player.isfold && roomlist[_tableid].hand >1){
			if(player.bet > 0){
				let updatePlayers =roomlist[_tableid].playersPendingUpdate
				let updatePlayer = updatePlayers.find(p=>(p.userid == _uid));
				if (updatePlayer == undefined){
						roomlist[_tableid].playersPendingUpdate.push(player);
				}
			}
		
			BetPoker.FoldAction(_io, _tableid, roomlist, _sit, true);
			player.isplay = false;

			if (BetPoker.PlayerInGame(roomlist[_tableid]) == 0){ // jika smua player berdiri
				console.log("[ CHIP PLAYER BACK ] playerpending ==>  ", roomlist[_tableid].playersPendingUpdate);
				for(playerupdate of  roomlist[_tableid].playersPendingUpdate){
					// console.log("[ IS PENDING ] ==> " + playerupdate.ispendingstand);
					// if(playerupdate.ispendingstand == undefined && playerupdate.userid == player.userid){
					// 	player.credit = 0;
					// }
					playerupdate.win = playerupdate.bet;
				}	
			}	
		}


		for(let x=0; x< 9 ; x++){
	        if(roomlist[_tableid].sit[x] == _uid){
	        	roomlist[_tableid].sit[x] = 0;
				roomlist[_tableid].active_player = await FuncGlobal.countPlay(roomlist[_tableid].sit);
	        }
	        if(players[x].userid == _uid){
	            players.splice(x, 1,{});
	        }
	   }
	   
		   await DBCommand.RemovePlayer(_tableid, _uid, _sit);
		   await Secure.UpdatePlayerLastGame(_uid);
	   	// await DBCommand.UpdateLastGame(null, _uid);
		await Secure.UpdateUserChipAfterGame(player.userid, player.credit, 101);
		   
	   	let param = {
			userid : parseInt(_uid), 
			playeringame : parseInt(roomlist[_tableid].active_player)
		   }

	   	exports.BroadcastEmit(_io, _tableid, 'player_stand', param);
	    // _io.to(exports.GetTableName(_tableid)).emit('player_stand', {userid : parseInt(_uid), playeringame : parseInt(roomlist[_tableid].active_player)});

		console.log("Player Stand hand lanjut sini: 2");

	   	if(player.isdisconnect){
			await Secure.ExitRoom(player.userid);
	   	} 
    }
    catch(error){
        console.log(ConsoleOutput.ErrorFont, '[ ==== ERROR PLAYER STAND ==== ]');
        console.log('[ ERROR PLAYER STAND ] MSG ==> '+error.message);
		QueryGlobal.DumpError(error);
    }
}

exports.CleanRoom = function(_tableId){
	try {
		console.log(ConsoleOutput.BgFontYellow, "[ ==== CLEAN PLAYER ==== ]");
		let currentroom = exports.FindRoom(_tableId);

		for (player of currentroom.player){
			if(player.userid == undefined) continue;
			player.card1 = 0;
			player.card2 = 0;
			player.bet = 0;
			player.raise = 0;
			player.isplay = false;
			player.action = "";
			player.hands = [];
			player.win = 0;
			player.isfold = false;
			player.isdone = false;
			player.valuecard = 0;
			player.typecard = "";
			player.typewin = "";
			player.jacpottype = -1;
			player.winjackpot = 0;;
			DBCommand.PlayerActivePlay(player);
		}
	
		currentroom.hand = 1;
		currentroom.pot = 0;
		currentroom.bet = 0;
		currentroom.raise = 0;
		currentroom.isSB = -1;
		currentroom.isBB = -1;
		currentroom.lastBet = 0;
		currentroom.lastTurn = 0;
		currentroom.cardTable = [];
		currentroom.spreadPot = [];
		currentroom.winBetArray = [];
		currentroom.msg = 'START NEW ROUND';
		currentroom.WinCard = [];
		currentroom.onprepare = 0;
		currentroom.gamelog = "";
		currentroom.jacpottype = -1;
		currentroom.winjackpot = 0;
		currentroom.same_jackpot = 0;
		DBCommand.InsertTpkTable(currentroom, _tableId);
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, '[ ==== ERROR PLAYER STAND ==== ]');
        console.log('[ ERROR PLAYER STAND ] MSG ==> '+error.message);
		QueryGlobal.DumpError(error);
		throw error;
	}
}

async function FindWinner (_tableId) {
	var i = 0;
	var multiwin = {};
	// let typeJpt = -1;

	while(i < 9){
		let player_info = {};

		if(roomlist[_tableId].player[i].userid != undefined && !roomlist[_tableId].player[i].isfold && roomlist[_tableId].player[i].isplay){
			player_info = await DeckCard.EvaluateHand(roomlist[_tableId].player[i].hands);
			roomlist[_tableId].player[i].hands =  player_info["cards"];
			roomlist[_tableId].player[i].jacpottype = await exports.CekJackpot(player_info["type"]);

			multiwin[i] = [player_info["value"], player_info["hand"], player_info["cards"], player_info["type"], roomlist[_tableId].player[i].userid];
		}
		i++;
	}
	let arsort_multiwin = [];

	for (var key in multiwin)
		arsort_multiwin.push([key, multiwin[key]]);

	arsort_multiwin = arsort_multiwin.sort(function(a, b){ return b[1][0] - a[1][0]});

	let multiwinners = {};

	for (var key in arsort_multiwin) {
		multiwinners[key] = {
			"player": arsort_multiwin[key][0],
			"userid": arsort_multiwin[key][1][4],
			"points": arsort_multiwin[key][1][0],
			"bet": parseInt(roomlist[_tableId].player[arsort_multiwin[key][0]].bet),
			"hand": arsort_multiwin[key][1][1],
			"cards": arsort_multiwin[key][1][2],
			"key": arsort_multiwin[key][1][3],
			"status": 0,
			"win": 0,
			"type": "",
			"msg": "",
		};
	}

	var points = 0;
	var bet = 0;
	// typeJpt = -1;
	for (var key in multiwinners) {
		if (multiwinners[key]["points"] >= points) {
			points = multiwinners[key]["points"];
			// typeJpt = await exports.CekJackpot(multiwinners[key]["key"]);
			roomlist[_tableId].type_jackpot = await exports.CekJackpot(multiwinners[key]["key"]);

			if (multiwinners[key]["bet"] > bet)
				bet = multiwinners[key]["bet"];

			multiwinners[key]['status'] = 1; //untuk menang dalam nilai kartu
		}
		else if (multiwinners[key]["bet"] > bet && Object.keys(multiwinners).length > 1 && key != 0) {
			bet = multiwinners[key]["bet"];
			multiwinners[key]['status'] = 2; //untuk menang dalam nilai Bet 
		}
	}

	var currenTotalBet= [];
	var chipSite = 0;
	console.log("=== MULTIWINNER : ", multiwinners);
	for(var key in multiwinners){
        if(multiwinners[key]['status'] == 1){
			chipSite += 1;
			roomlist[_tableId].same_jackpot += 1;
        }
	}
	
	for(var key in roomlist[_tableId].spreadPot){
        if (roomlist[_tableId].spreadPot[key]){
            currenTotalBet.push(roomlist[_tableId].spreadPot[key]);
        }
	
	}

	if (chipSite > 1){ // for split
        for (Spreadbetplayer of roomlist[_tableId].spreadPot){
            
            for (var playerbetwin of Spreadbetplayer["uids"]){
                for(var key in multiwinners){
                    if(multiwinners[key]["userid"] == playerbetwin){
                        roomlist[_tableId].player[multiwinners[key]['player']].win += (Spreadbetplayer["totalBet"]/Spreadbetplayer["uids"].length);
                    }
                }
            }
            roomlist[_tableId].winBetArray.push({'uids':Spreadbetplayer["uids"], totalBet : Spreadbetplayer["totalBet"]});
        }
    } else {
        for(var key in multiwinners){
            if(multiwinners[key]['status'] == 0) continue;
            for (var sb in currenTotalBet){ //spread betnya
				for(var ub in currenTotalBet[sb]["uids"]){ // userid yang dapat betnya
                    if(currenTotalBet[sb]['uids'] === undefined) continue;
                    if(multiwinners[key]["userid"] == currenTotalBet[sb]["uids"][ub]){
                        roomlist[_tableId].player[multiwinners[key]['player']].win += currenTotalBet[sb]["totalBet"];
                        roomlist[_tableId].winBetArray.push({'uids':[multiwinners[key]["userid"]], 'totalBet': currenTotalBet[sb]["totalBet"]});
                        currenTotalBet.splice(sb, 1, {});   
                    }  
                }
            }
        }
    }

	var winningPoint = 0;
	var prevKey = "";

	for(var key in multiwinners) {
		if(multiwinners[key]['status'] == 0) continue;

		var msg = "";
		if(winningPoint == 0) {
			winningPoint = multiwinners[key]['points'];
			msg = roomlist[_tableId].player[multiwinners[key]['player']].userid + ' wins ' + multiwinners[key]['key'] + ' ' + multiwinners[key]['hand'];//*

			multiwinners[key]['type'] = "win";
			multiwinners[key]['msg'] = msg;
			roomlist[_tableId].msg = msg;
			roomlist[_tableId].WinCard = multiwinners[key]['cards'];
			roomlist[_tableId].typecardwin = multiwinners[key]['key'];
			roomlist[_tableId].valuecard = multiwinners[key]['hand'];
			roomlist[_tableId].player[multiwinners[key]['player']].typewin = "WINNER";
		} else if(winningPoint == multiwinners[key]['points']) {
			msg = 'Split pot ' + multiwinners[key]['key'] + ' ' + multiwinners[key]['hand'];

			multiwinners[key]['type'] = "split"; //split pot
			roomlist[_tableId].player[multiwinners[key]['player']].typewin = "SPLIT";

			if(prevKey != "") {
				multiwinners[prevKey]['type'] = "split"; //set first winner to split
				multiwinners[prevKey]['msg'] = msg;
				roomlist[_tableId].msg = msg;
				roomlist[_tableId].typecardwin = multiwinners[key]['key'];
				roomlist[_tableId].valuecard = multiwinners[key]['hand'];
				roomlist[_tableId].WinCard = multiwinners[key]['cards'];
			}
		} else if(winningPoint >= multiwinners[key]['points']) {
			multiwinners[key]['type'] = "side"; //main pot winner all other players side pot
			roomlist[_tableId].player[multiwinners[key]['player']].typewin = "SIDE";
		}
		multiwinners[key]['msg'] = msg;
		prevKey = key;
	}

	DBCommand.SaveErrorLog('>> DATA FIND WINNER', 'DATA PLAYER : '+ exports.PlayerToString(roomlist[_tableId].player), 'ROOMLIST : ' + exports.RoomsToString(roomlist[_tableId]));
	return multiwinners;
}

//====================================== EMIT ACTION =============================//

exports.GetBanned = async function(_userid, _seatid, _tableid, _io, _socketid){
	try{
		let cekbanned = await Secure.CheckPlayerStatus(_userid);
		console.log("GET BANNED : "+ cekbanned);
		if(cekbanned != true){
			if (roomlist[_tableid].id ==  undefined) throw Error("Room Not Found");

			if (roomlist[_tableid].player.find(p=>(p.userid==_userid)) != undefined){
				await exports.PlayerStand(_io, _userid, _seatid, _tableid);
			}

			await Secure.ExitRoom(_userid);
			
			let param = {};
			param["banned"]= {msg : "user has been banned with code "+cekbanned};
			_io.to(_socketid).emit('player_banned', param);
			_io.sockets.sockets[_socketid].disconnect();
			return true;
		} else return false;
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR IN BANNED ==== ] ", error.message);
		QueryGlobal.DumpError(error);
		throw Error (error.message);
	}
}

exports.GetJackpot = async function(_rooms, _io, _tableId){
	try{
		let param = {};
		let sendjackpot = 0;
		let jackpotforplayer = 0;
		let jpttype = [_rooms.royal_flush, _rooms.straight_flush, _rooms.four_of_a_kind, _rooms.fullhouse, _rooms.flush];
		for (var playerjackpot of _rooms.player){
			if (playerjackpot.hasOwnProperty('jacpottype')){		
				if(playerjackpot.isfold || !playerjackpot.isplay || playerjackpot.jacpottype == -1) continue;
				if (_rooms.type_jackpot == playerjackpot.jacpottype && playerjackpot.typewin == "WINNER" || _rooms.type_jackpot == playerjackpot.jacpottype && playerjackpot.typewin == "SPLIT"){
					if(_rooms.same_jackpot > 1){
						playerjackpot.winjackpot = (_rooms.jackpot * jpttype[playerjackpot.jacpottype]) /_rooms.same_jackpot;
						playerjackpot.credit += playerjackpot.winjackpot;
						jackpotforplayer += playerjackpot.winjackpot;
					}else if(playerjackpot ){
						playerjackpot.winjackpot = (_rooms.jackpot * jpttype[playerjackpot.jacpottype]);
						playerjackpot.credit += playerjackpot.winjackpot;
						jackpotforplayer += playerjackpot.winjackpot
					}
					await Secure.PlayerWin(playerjackpot.userid, playerjackpot.winjackpot, playerjackpot.credit, exports.idgame);
					param["player" + playerjackpot.seatid] ={
						uid:playerjackpot.userid,
						seatid:playerjackpot.seatid,
						winjackpot:playerjackpot.winjackpot,
						credit:playerjackpot.credit
					}
					await QueryGlobal.InsertPlayerTransactionDay(exports.idgame, playerjackpot.userid, 0, 0, 0, 0, playerjackpot.winjackpot);
					sendjackpot +=1;
				}
			}
		}

		if(sendjackpot > 0){
			_rooms.jackpot -= jackpotforplayer;
			param["dataTable"] = {jackpot : _rooms.jackpot};
			exports.BroadcastEmit(_io, _tableId, 'win_jackpot', param);
			// _io.to(exports.GetTableName(_tableId)).emit('win_jackpot', param);
		}
		
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, '[ ==== ERROR GET JACKPOT ==== ]');
        console.log('[ ERROR GET JACKPOT ] MSG ==> '+error.message);
		QueryGlobal.DumpError(error);
	}
	
}

exports.DataParam = async function (_tableId){
	let param = {};
	
	for(let i_sit = 0; i_sit < 9; i_sit++){
		if (roomlist[_tableId].active_player == 0) continue;
		if (roomlist[_tableId].player[i_sit].userid == undefined) continue;

		param["player" + i_sit] = {
			userid: parseInt(roomlist[_tableId].player[i_sit].userid),
			seatid: parseInt(roomlist[_tableId].player[i_sit].seatid),
			isfold: roomlist[_tableId].player[i_sit].isfold ? 1 : 0, //parseInt(roomlist[_tableId].player[i_sit].isfold),
			isplay: roomlist[_tableId].player[i_sit].isplay ? 1 : 0, //parseInt(roomlist[_tableId].player[i_sit].isplay),
			isaction: parseInt(roomlist[_tableId].player[i_sit].isaction),
			action: parseInt(roomlist[_tableId].player[i_sit].action),
			itemgift: parseInt(roomlist[_tableId].player[i_sit].itemgift), 
			isautoplay : roomlist[_tableId].player[i_sit].isautoplay,
			credit: parseFloat(roomlist[_tableId].player[i_sit].credit),
			bet : parseFloat(roomlist[_tableId].player[i_sit].bet),
			raise : parseFloat(roomlist[_tableId].player[i_sit].raise),
			name: roomlist[_tableId].player[i_sit].name,
			avatar: roomlist[_tableId].player[i_sit].avatar,
				
		};
	}

	param["dataTable"]= {
		timer:parseFloat(roomlist[_tableId].turntimer),
		currentTimerRemaining : parseFloat(roomlist[_tableId].onTurnTimerElapse),
		minbuy: roomlist[_tableId].minBuy,
		maxbuy: roomlist[_tableId].maxBuy,
		sb: parseFloat(roomlist[_tableId].sb),
		bb: parseFloat(roomlist[_tableId].bb),
		pot: parseFloat(roomlist[_tableId].pot),
		bet: parseFloat(roomlist[_tableId].bet),
		raise: parseFloat(roomlist[_tableId].raise),
		jackpot: parseInt(roomlist[_tableId].jackpot),
		maxplayer :  parseInt(roomlist[_tableId].max_player),
		dealer : roomlist[_tableId].dealer,
		playersb : roomlist[_tableId].isSB,
		playerbb : roomlist[_tableId].isBB,
		hand: roomlist[_tableId].hand,
		turn: roomlist[_tableId].turn,
		nametable : roomlist[_tableId].nameTable
	};
	return param;
}

exports.SendRankPlayerCard = async function(_tableId, _hand){
	console.log(ConsoleOutput.FontMagenta, "====== HAND ==== :", _hand);
	for(var i = 0; i < 9; i++){
		if(roomlist[_tableId].player[i].userid == undefined) continue;
		if(!roomlist[_tableId].player[i].isplay) continue;
		if(roomlist[_tableId].player[i].card1 == 0 || roomlist[_tableId].player[i].card2 == 0) continue;
		// if(roomlist[_tableId].player[i].isfold == 1) continue;
		for(var a = 2; a < 7; a++){
			if (_hand == 5){
				if (a < 5){
					roomlist[_tableId].player[i].hands[a] = roomlist[_tableId].cardTable[(a-2)];
				}
			} if (_hand == 7){
				if (a == 5) {
					roomlist[_tableId].player[i].hands[a] = roomlist[_tableId].cardTable[(a-2)];
				}
			} if (_hand == 9){
				if (a > 5 ) {
					roomlist[_tableId].player[i].hands[a] = roomlist[_tableId].cardTable[(a-2)];
				}
			}	
		}

		let player_info = await DeckCard.EvaluateHand(roomlist[_tableId].player[i].hands);
		roomlist[_tableId].player[i].valuecard = player_info["value"];
		roomlist[_tableId].player[i].typecard = player_info["type"];
	}
}

exports.SendTableCard = async function(_io, _tableId, _hand ){
	let param = {};
	let cardsCount;
	let arrayBet= [];

	for (bet of roomlist[_tableId].spreadPot){
		arrayBet.push(bet.totalBet);
	}

	switch(_hand){
		case 5:
			param["dataTable"] = {
				hand: parseInt(_hand),
				pot: parseFloat(roomlist[_tableId].pot),
				cardtable: [
					parseInt(roomlist[_tableId].cardTable[0]), 
					parseInt(roomlist[_tableId].cardTable[1]), 
					parseInt(roomlist[_tableId].cardTable[2])],
				spreadPot: arrayBet
				// cardtable2: parseInt(roomlist[_tableId].cardTable[1]),
				// cardtable3: parseInt(roomlist[_tableId].cardTable[2])
			}
			cardsCount = 3;
			await exports.SendRankPlayerCard(_tableId, _hand);
			break;
		case 7:
			param["dataTable"] = {
				hand: parseInt(_hand),
				pot: parseFloat(roomlist[_tableId].pot),
				cardtable:[parseInt(roomlist[_tableId].cardTable[3])],
				spreadPot: arrayBet
				// cardtable4: parseInt(roomlist[_tableId].cardTable[3])
			}
			cardsCount = 4;
			await exports.SendRankPlayerCard(_tableId, _hand);
			break;
		case  9: 
			param["dataTable"] = {
				hand:parseInt(_hand),
				pot: parseFloat(roomlist[_tableId].pot),
				cardtable: [parseInt(roomlist[_tableId].cardTable[4])],
				spreadPot: arrayBet
				// cardtable5: parseInt(roomlist[_tableId].cardTable[4])
			}
			cardsCount = 5;
			await exports.SendRankPlayerCard(_tableId, _hand);
			break;
	}
	exports.BroadcastEmit(_io, _tableId, 'OnCardTable', param);
	// _io.to(exports.GetTableName(_tableId)).emit('OnCardTable', param);
	let str_log = '\n{"game_state":"SHOW_CARD_'+cardsCount+'","hand":'+_hand+',"cardtable":"'+roomlist[_tableId].cardTable+'"}';
	roomlist[_tableId].gamelog += str_log;

	for(playerData of roomlist[_tableId].player.filter(p=>p.card1!=0 && p.card2!=0 && p.isplay === true)){
		param = {};
        param["player"] = {
			userid: playerData.userid,
			typecard: playerData.typecard,
			valuecard : parseFloat(playerData.valuecard)   
		}
		_io.to(playerData.socketid).emit('player_handrank', param);
    }
}

exports.SyncCardTable = async function(_socket, _tableId, _hand ){
	let param = {};
	let arrayBet= [];

	for (bet of roomlist[_tableId].spreadPot){
		arrayBet.push(bet.totalBet);
	}


	switch(_hand){
		case 5:
			param["dataTable"] = {
				hand: _hand,
				pot: parseFloat(roomlist[_tableId].pot),
				cardtable: [
					parseInt(roomlist[_tableId].cardTable[0]), 
					parseInt(roomlist[_tableId].cardTable[1]), 
					parseInt(roomlist[_tableId].cardTable[2])],
				spreadPot: arrayBet
			}
			break;
		case 7:
			param["dataTable"] = {
				hand: _hand,
				pot: parseFloat(roomlist[_tableId].pot),
				cardtable:[parseInt(roomlist[_tableId].cardTable[3])],
				spreadPot: arrayBet
			}
			break;
		case  9: 
			param["dataTable"] = {
				hand: _hand,
				pot: parseFloat(roomlist[_tableId].pot),
				cardtable: [parseInt(roomlist[_tableId].cardTable[4])],
				spreadPot: arrayBet
			}
			break;
	}
	_socket.emit("OnCardTable", param);
}

async function SendReconnectPlayerCard(_socket, _tableId){
	console.log("Reconnect Card ", _socket.user);
	try{
		for(playerData of roomlist[_tableId].player.filter(p=>p.userid===_socket.user.userid && p.isplay === true)){
			let param = {}
			param["player"] = {
				userid: playerData.userid,
				card: [playerData.card1, playerData.card2]
			}
			_socket.emit('player_card', param);
		}
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "[ ==== ERROR Reconnect Card ==== ]", error.message);
		QueryGlobal.DumpError(error);
	}
	
}

async function SendPlayerCard(_io, _tableId){
	
	for(playerData of roomlist[_tableId].player.filter(p=>p.isfold===false && p.isplay === true)){
		let param = {}
        param["player"] = {
			userid: playerData.userid,
			card: [playerData.card1, playerData.card2]
		}
		// param["dataTable"] = {hand: roomlist[_tableId].hand}
		console.log("=================SEND PLAYER CARD============== EMIT TO SOCKET : "+ playerData.socketid);
		console.log("================= DATA TERKIRIM : ", param);
		_io.to(playerData.socketid).emit('player_card', param);
	}
	param = {};
	param["dataTable"] = {hand: roomlist[_tableId].hand};
	exports.BroadcastEmit(_io, _tableId, 'roundstart_sender', param);
	// _io.to(exports.GetTableName(_tableId)).emit('roundstart_sender', param);
}

async function ParamDataTurn (_io, _tableId, _hand){
	try{
		let param = {};
		if(_hand > 11){
			for(let i_sit = 0; i_sit < 9; i_sit++){
				if (roomlist[_tableId].active_player == 0) continue;
				if (roomlist[_tableId].player[i_sit].userid == undefined) continue;
				if (!roomlist[_tableId].player[i_sit].isplay) continue;
				if (roomlist[_tableId].player[i_sit].isfold) continue;
				
				if (_hand == 12){
					param["player" + i_sit] = {
						userid: roomlist[_tableId].player[i_sit].userid,
						seatid: parseInt(roomlist[_tableId].player[i_sit].seatid),
						card: [roomlist[_tableId].player[i_sit].card1, roomlist[_tableId].player[i_sit].card2],
						hand: roomlist[_tableId].player[i_sit].hands,
						typecard: roomlist[_tableId].player[i_sit].typecard,
						win: parseFloat(roomlist[_tableId].player[i_sit].win)	
					};
				} else if(_hand == 13){
					param["player" + i_sit] = {
						userid: parseInt(roomlist[_tableId].player[i_sit].userid),
						seatid: parseInt(roomlist[_tableId].player[i_sit].seatid),
						credit: parseFloat(roomlist[_tableId].player[i_sit].credit),
						typewin: roomlist[_tableId].player[i_sit].typewin,
						win: parseFloat(roomlist[_tableId].player[i_sit].win)
					};
				} else if(_hand == 14){
					param["player" + i_sit] = {
						userid: roomlist[_tableId].player[i_sit].userid,
						seatid: parseInt(roomlist[_tableId].player[i_sit].seatid),
						credit: parseFloat(roomlist[_tableId].player[i_sit].credit)
					};

				}
			}

			if (_hand == 12){
				param["dataTable"] = {
					pot: parseFloat(roomlist[_tableId].pot),
					hand: parseInt(roomlist[_tableId].hand),
					wincard : roomlist[_tableId].WinCard !== undefined ? roomlist[_tableId].WinCard: [0],
					type : roomlist[_tableId].typecardwin, 
					value : roomlist[_tableId].valuecard
				}
			}
			if (_hand == 13){
				param["dataTable"] = {
					hand: roomlist[_tableId].hand,
					msg : roomlist[_tableId].msg,
					winbetarray : roomlist[_tableId].winBetArray
				}
			}
			if (_hand == 14){
				param["dataTable"] = {hand: roomlist[_tableId].hand, jackpot : roomlist[_tableId].jackpot}
			}

		} else {
			let arrayBet= [];

			for (bet of roomlist[_tableId].spreadPot){
				arrayBet.push(bet.totalBet);
			}

			param["dataTable"] = {
				hand: parseInt(roomlist[_tableId].hand),
				turn: parseInt(roomlist[_tableId].turn),
				bet: parseFloat(roomlist[_tableId].bet),
				pot: parseFloat(roomlist[_tableId].pot),
				raise: parseFloat(roomlist[_tableId].raise),
				actplayer : parseInt(roomlist[_tableId].active_player),
				spreadPot: arrayBet
			}
		}

		console.log("============== ParamDataTurn : " + _hand);
		exports.BroadcastEmit(_io, _tableId, 'turnaction_sender', param);
		
		// _io.to(exports.GetTableName(_tableId)).emit('turnaction_sender', param);		
	}catch(err){
		console.log(ConsoleOutput.ErrorFont, "PLAYER SEND DATA ERROR  : " + err.message);
		QueryGlobal.DumpError(err);
	}
}

exports.BroadcastEmit = function(_io, _tableId, _emit, _param){
	console.log("==== IN BROAD CAST : " + _emit);
	try{
		for (c of Room.clients){
			if(c.tableid != _tableId) continue;
			console.log("==== UID BROAD CAST : ",c.userid); 
			_param["ceksocket"] = {ID: c.socketid};
			_io.to(c.socketid).emit(_emit, _param);
		}
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "Broad Cast  : " + err.message);
		QueryGlobal.DumpError(err);	
		throw error;	
	}
}

//====================================== FUNCTION HELPER =============================//
//#region helper

exports.FindClient = function(_userid){
	try{
		const client = Room.clients.find(c => c.userid == _userid);

		if (client == undefined) throw Error("Client Not Found");

		return client;
	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "Find Client ERROR  : " + error.message);
		QueryGlobal.DumpError(error);
		throw error
	}
}

exports.FindRoom = function(_tableid){
	try{
		let rooms = {};

		for (let id in roomlist){
			if (roomlist[id].id != _tableid) continue;
				rooms = roomlist[id];
		}
	
		if(rooms == {}) throw Error("Rooms Not Found");

		return rooms;

	}catch(error){
		console.log(ConsoleOutput.ErrorFont, "Find Rooms ERROR  : " + error.message);
		QueryGlobal.DumpError(error);
		throw error
	}
	
}

function GetSit(_tableId){
	for (var i = 0; i < 9; i++) {
		if (roomlist[_tableId].sit[i] == 0) {
			if (roomlist[_tableId].max_player == 5) {
				if (i == 1 || i == 3 || i == 5 || i == 7 || i == 9) continue;
				return i;
			} else {
				return i;
			}
		}
	}
	return -1;
}

exports.Delay = function (_millis){
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(_millis);
            reject(-1);
        }, _millis);
    });
};
//#endregion


// for Debug
exports.RoomsToString = function(_rooms){
	let roomstring = "id : "+_rooms.id + ", nameTable: " + _rooms.nameTable+ ", roomid: " + _rooms.roomid + ", roundid: " + _rooms.roundid + ", status: " + _rooms.status + ", turn: "
	+ _rooms.turn + ", pot: " + _rooms.pot + ", sb: " + _rooms.sb + ", bb: " + _rooms.bb + ", minbuy: " + _rooms.minBuy + ", maxbuy: " + _rooms.maxBuy + ", bet: " + _rooms.bet 
	+ ", hand: "+ _rooms.hand + ", lasthand: " + _rooms.lasthand + ", dealer: " + _rooms.dealer + ", issb: "+_rooms.isSB+", isbb: "+ _rooms.isBB + ", timer: " + _rooms.timer
	+ ", timestart: " + _rooms.timeStart + ", onturntimelapse: " + _rooms.onTurnTimerElapse +", cardtable: " + JSON.stringify(_rooms.cardTable) + ", autoplaythread: " + _rooms.autoplaythread
	+ ", isallfold: " + _rooms.isallfold;
	return roomstring;
}

exports.PlayerToString = function(_player){
	var playerstring;
	for(let pp of _player){
		playerstring += "{ userid: "+pp.userid+", name: "+pp.name+", userkey: "+pp.userkey+", sessionid: "+ pp.sessionid+", socketid: " +pp.socketid+", seatid: "+pp.seatid+", credit: "+pp.credit+", isplay: "+pp.isplay
		+", isdone: " +pp.isdone+", isfold: "+pp.isfold+", isautoplay: "+pp.isautoplay+", afkcounter: "+pp.afkcounter+", card1: "+pp.card1+", card2 : "+pp.card2+", bet: "+pp.bet+", raise: "+pp.raise+", action: "+pp.action
		+", win: "+pp.win+", valuecard: "+pp.valuecard+", typecard: "+pp.typecard+", typewin: "+pp.typewin+", roundgame: "+pp.roundgame+"},"
	}
	return playerstring;
}