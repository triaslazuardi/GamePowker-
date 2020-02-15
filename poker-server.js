require("dotenv").config();
const tpk = require('./app/poker/poker');
const Rooms = require('./app/poker/room');
const DBCommand = require('./app/poker/db_command');
const Lobby = require('./app/casino_menu/lobby');
const Global = require('./app/global/global_query');
const ColorConsole = require('./app/casino_menu/console_output');
const Secure = require('./app/casino_menu/secure');
const express = require('express');
const socketio = require('socket.io');
const session = require('express-session');

const app = express();
const host = process.env.SERVER_HOST;
const port = process.env.SERVER_TPK_PORT;

const sessionMiddleware = session({
	secret: process.env.SESSION_SECRET,
    resave: process.env.SESSION_RESAVE,
    saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED,
    cookie: {
		maxAge: 60000
	}
    // maxAge: process.env.SESSION_COOKIE_MAX_AGE}

});



const server = app.listen(port, host, async function () {
	console.log('Server started on port: ' + port);
	tpk.Start();
});

global.sql = require('./config/database.js');

const io = socketio.listen(server);
io.set('heartbeat timeout', 30000);
io.set('heartbeat interval', 2000);

io.use(function (socket, next) {
	sessionMiddleware(socket.request, socket.request.res || {}, next);
});
// app.use(sessionMiddleware);

// app.use(express.static('./'));

const gamecode = 'TPK';


io.on('connection', function (socket) {
	console.log('socket.io: new connection, current number of authorized connections:', Rooms.clients.length);

	socket.use(async function (packet, next) {
		let socketSkip = ["connect_admin", "ping", "disconnect"];
		
		try{

			if (Rooms.clients.find(c => c.ip == socket.request.connection.remoteAddress && c.socketid == socket.id  && c.admin) !== undefined) {
				return next();
			}

			if (socketSkip.indexOf(packet[0]) >= 0) return next();
			else CheckLogin(io,socket,packet,next);

		}catch (error){
			console.log(ColorConsole.ErrorFont, "[ ==== ERROR SOCKET USE ==== ] PACKET[0] ==> "+packet[0]);
            console.log(ColorConsole.ErrorFont, "[ ERROR SOCKET USE ] MSG ==> ", error.message);
			Global.DumpError(error);
			let param = {msg: error.message, type:"auth"};
			socket.emit('fail_data', param);
		}
	});

	//#region Admin
	socket.on('connect_admin', async (data) => {
		console.log(ColorConsole.BgFontMagenta, "[ ==== LOGIN AREA FOR ADMIN ==== ]");
		console.log(ColorConsole.FontMagenta, "[ LOGIN AREA FOR ADMIN ] Data ==> ", data);
	
		try {
			if (socket.user != undefined) return;

			let admin = await Global.GetAdminByUsernamePassword(data.username, data.password);
			socket.user = new Rooms.Client(socket.request.connection.remoteAddress, socket.id, true, data.tableid, admin.uid, data.username);
			Rooms.PushClient(socket.user);

			socket.emit('connect_admin', {admin: "ok"});
		} catch (error) {
		  	console.log(ColorConsole.ErrorFont, '[ ==== ERROR LOGIN AREA ==== ]');
		  	console.log(ColorConsole.ErrorFont, '[ ERROR LOGIN AREA ] MSG ==> '+ error.message);
		  	socket.emit("fail_data", (msg = {
				msg: error.message
		  	}));
		}
	})

	socket.on('clear_room', async function (data) {
		try{
			console.log("[ Clear Room ] => ", socket.user);
			const tableid = socket.user.tableid;
			const currentroom = tpk.FindRoom(tableid);

			for (player of currentroom.player){
				if(player.userid == undefined) continue;
				io.to(player.socketid).emit('exit_room');
				player.isstand = true;
				await tpk.PlayerStand(io,player.userid, player.seatid, tableid);	
			}

			tpk.CleanPlayer(tableid);
		}catch(error){
			console.log("[ ERROR SOCKET KICK OUT PLAYER ] ==> DATA : " , error.message);
		}
	});
	//#endregion
	
	socket.on('user_autoplay', async function(data){
		try{
			console.log(ColorConsole.BgFontMagenta, "[ ==== LOGIN USER AUTO PLAY ==== ]");
			console.log(ColorConsole.BgFontMagenta, "[ LOGIN USER AUTO PLAY ] user ==> ", socket.user);

			let currentRoom = false;
			for(let rooms in tpk.rooms){
				if(rooms == socket.user.tableid){
					currentRoom = true;
				}
			}

			if (!currentRoom) throw Error;
			
			let isAutoplay = tpk.SetAutoplay(io, socket.user.userid, socket.user.tableid);

			socket.emit('set_autoplay',{ isError: false, errMsg: '', isAutoplay: isAutoplay});
		}catch(error){
			console.log(ColorConsole.ErrorFont, "[ ==== LOGIN USER AUTO PLAY ==== ]");
			console.log(ColorConsole.ErrorFont, "[ LOGIN USER AUTO PLAY ] MSG ==> ", error.message);
			Global.DumpError(error);
			socket.emit('set_autoplay',{isError: true, errMsg: error.message});
		}
	});

	socket.on('user_profile', async function(data){
		console.log(ColorConsole.BgFontMagenta, "[ ==== USER PROFILE AREA ==== ]");
		let param = {};
        try{
			const profile = await Lobby.GetUserProfile(socket.user.userid);
			
			param["error"] = { err: 0, msg:'user_logged_in' };
			param["profile"] = profile;
            socket.emit("profile_sender", param);
        }
        catch(error){
			console.log(ColorConsole.BgFontMagenta, "[ ==== ERROR USER PROFILE AREA ==== ]");
			console.log(ColorConsole.BgFontMagenta, "[ ERROR USER PROFILE AREA ] MSG ==> "+ error.message);
			param["error"] = { err: 1, msg:'user_not_logged_in' };
			Global.DumpError(error);
            socket.emit("profile_sender", param);
        }
    });

	socket.on('room_sync', async function(data){
		tpk.DataSync(socket, io, data);
	});

	socket.on('playerjoin_listener', function (data) {
		tpk.JoinTable(socket, io, data);
	});

	socket.on('turnaction_listener', function (data) {
		tpk.TurnAction(socket.user, io, data, false);
	});

	socket.on('player_stand', function (data) {
		console.log(ColorConsole.BgFontMagenta, "[ ==== PLAYER STAND AREA ==== ] userid : " + socket.user.userid);
		DBCommand.SaveErrorLog('>> PLAYER STAND', 'DATA FROM PLAYER : '+ socket.user.userid, 'PLAYER STAND DATA FROM PLAYER STAND');
		tpk.PlayerStand(io, socket.user.userid, data.sit, socket.user.tableid);
	});
	

	socket.on('player_chat', function(data){
		try{
			console.log(ColorConsole.BgFontMagenta, "[ ==== PLAYER CHAT AREA ==== ]");
			for(let rooms in tpk.rooms){
				if(rooms == socket.user.tableid){
					io.to(tpk.GetTableName(socket.user.tableid)).emit('player_chat', {userid : socket.user.userid, msg : data.msg});
				}
			}

		}catch(error){
			console.log(ColorConsole.ErrorFont, "[ ==== ERROR PLAYER STAND ==== ]");
			console.log(ColorConsole.ErrorFont, "[ ERROR PLAYER STAND ] MSG ==> ", error.message);
			Global.DumpError(error);
		}
    });

	socket.on('player_emoticon', async function(data){//lom
		try{
			console.log(ColorConsole.BgFontMagenta, "[ ==== PLAYER EMOTICON AREA ==== ]");
			for(let rooms in tpk.rooms){
				if(rooms == socket.user.tableid){

					const rows = await sql.query('SELECT id, name, price, category_id, img_ver, status FROM emoticon WHERE id = ' + data.emotId + ' LIMIT 1');
					if(rows.length == 0){
						console.log("emot not found");
						err = "Emot NOT FOUND";
						socket.emit('get_gift_emoticon_fail', {msg : "emot", err: err});
						return;
					}

					let value = {userid : socket.user.userid,
								emotId:data.emotId.toString(),
								price : rows[0].price,
								img_ver: rows[0].img_ver,
								width: 200,
								height: 200,
								frame: 3
							}

					io.to(tpk.GetTableName(socket.user.tableid)).emit('player_emoticon', value);
				}
			}

		}catch(error){
			console.log(ColorConsole.ErrorFont, "[ ==== ERROR PLAYER EMOTICON ==== ]");
			console.log(ColorConsole.ErrorFont, "[ ERROR PLAYER EMOTICON ] MSG ==> ", error.message);
			Global.DumpError(error);
			socket.emit('get_gift_emoticon_fail', {msg : "emoticon", err: error});
		}
    });

	socket.on('player_gift', async function(data){
		try{
			console.log(ColorConsole.BgFontMagenta, "[ ==== PLAYER GIFT ==== ]", data);
			let countReceive =0;
			let receiveSit = [];
			for(let rooms in tpk.rooms){
				if(rooms == socket.user.tableid){

					let players = tpk.rooms[rooms].player;
					let player= players.find(p=>p.userid== data.sender);

					if(player==undefined){
                		throw Error('player_not_found');
            		}
					let receiver = StringToNumArray(data.receiver);

					for(let x=0; x<receiver.length; x++){
                		let rp = players.find(p=>p.userid== receiver[x]);
                		if(rp==undefined)continue;
						countReceive += 1;
						receiveSit.push(x);
            		}

					const rows = await sql.query('SELECT id, name, price, category_id, width, height, img_ver FROM gift WHERE id = ' + data.giftId + ' LIMIT 1');
					if(rows.length == 0){
						throw Error('gift_not_found');
					}

					let price = await Secure.BuyGift2(player.userid, data.giftId, countReceive);

					for(let x=0; x<receiver.length; x++){
                		let rp = players.find(p=>p.userid== receiver[x]);
                		if(rp==undefined)continue;
						rp.itemgift=data.giftId;
						rp.itemgiftcategory=data.category;
            		}
					

					let updatedUserChip = await Lobby.GetUserChip(player.userid);
					console.log("gift found");
					
					let value = {sender: data.sender,
								giftId:data.giftId.toString(),
								gprice : rows[0].price,
								ctgr_id: rows[0].category_id,
								img_ver: rows[0].img_ver,
								width: rows[0].width,
								height: rows[0].height,
								frame: 3,
								receive: receiveSit,
								// receive: data.receiver,
								price : parseFloat(price),
								currentchip: updatedUserChip
							}
					io.to(tpk.GetTableName(socket.user.tableid)).emit('player_send_gift', value);
				}
			}

		}catch(error){
			console.log(ColorConsole.ErrorFont, "[ ==== ERROR PLAYER GIFT ==== ]");
			console.log(ColorConsole.ErrorFont, "[ ERROR PLAYER GIFT ] MSG ==> ", error.message);
			Global.DumpError(error);
			socket.emit('get_gift_emoticon_fail', {msg : "gift", err: err});
		}
    });
	
	socket.on('ping', async function (data) {
		if (socket.user == undefined) {
			return;
		}

		for(let rooms in tpk.rooms){
			if(tpk.rooms[rooms].id == socket.user.tableid){
				socket.emit('ping');
			}
		}
	});

	socket.on('exit_game', async function(data){
		console.log("[ EXIT_GAME ] ==> DATA : ", data);
		console.log("[ EXIT_GAME ] ==> U : ", socket.user);
		try{
			if(socket.user == undefined) throw Error("Socket Undefine"); 

			const tableid = socket.user.tableid;
			const currentroom = tpk.FindRoom(tableid);
			console.log("[EXIT GAME : ] currentroom : ", currentroom);
			if(currentroom.player[data.sit] == undefined) throw Error("Player Not Found");
			console.log("[ EXIT_GAME ] ==> CP : ", currentroom.player[data.sit]);
			if(socket.user.admin){
				io.to(currentroom.player[data.sit].socketid).emit('exit_room');
				await tpk.PlayerStand(io, data.userid, data.sit, tableid);
				return;
			}

			await tpk.PlayerStand(io, socket.user.userid, data.sit, tableid);
			DBCommand.SaveErrorLog('>> PLAYER EXIT GAME', 'DATA FROM PLAYER : '+ socket.user.userid, 'PLAYER STAND DATA FROM DISCONNECT');
			// await Rooms.RemoveClient(socket.user.userid);
			console.log("[ EXIT GAME ] Client ==> ", Rooms.clients);
			// delete socket.user;

		}catch(error){
			console.log("[ERROR CLIENT EXIT GAME] : " + error.message);
			Global.DumpError(error);
		}
	});

	socket.on('disconnect', async function(data){ // ping timeout ada ketika client sudah tidak ada interaksi ke server
		console.log("[ ==== DISCONNECT AREA ==== ]");
		console.log("[ DISCONNECT ] DATA ==> ", data);
		console.log("[ DISCONNECT ] SESSION ==> ", socket.user);

		try{

			if (socket.user == undefined) return;

			console.log("[ DISCONNECT ] ALL CLIENT ==>", Rooms.clients);
			DBCommand.SaveErrorLog('>> DISCONNECT', 'DATA FROM PLAYER : '+ socket.user.userid, 'DATA DISC : ' + data);	
			
			const client = tpk.FindClient(socket.user.userid);
			console.log("[ DISCONNECT ] CLIENTS ==> ");
			console.log("[ DISCONNECT ] ==> CLIENT PASS");

			const rooms = tpk.FindRoom(socket.user.tableid);
			console.log("[ DISCONNECT ] ==> ROOMS PASS");

			const player = rooms.player.find(p => p.userid == socket.user.userid);

			if(player == undefined) { //jika player berdiri duluan
				console.log("[ DISCONNECT ] ==> PLAYER BERDIRI DULUAN");
				Rooms.RemoveClient(client.userid);
				await Secure.ExitRoom(client.userid);
				delete socket.user;
			}else {
				console.log("[ DISCONNECT ] ==> PLAYER PASS");
				DBCommand.SaveErrorLog('>> PLAYER STAND', 'DATA FROM PLAYER : '+ socket.user.userid, 'PLAYER STAND DATA FROM DISCONNECT');
				player.isdisconnect = true;

				if(!player.isplay){ // hapus player jika ruangan tidak memulai game
					await tpk.PlayerStand(io, player.userid, player.seatid, rooms.id);
				} else { // delay hapus player hingga ronde game berakhir
					if (rooms.hand >=4 || rooms.hand <= 11 && rooms.turn == player.seatid && rooms.timer !== null)
						// tpk.SetAutoplay(io, player.userid, rooms.id);
						tpk.StartAutoPlay(io, rooms.id, player.seatid, player.userid, 50);
				}

				Rooms.RemoveClient(client.userid);
				delete socket.user;
				console.log("[ DISCONNECT ] DELETE ==> ", Rooms.clients);
			}		

		}catch(error){
			console.log("[ ERROR DISCONNECT ] MSG ==> " + error.message);
			Global.DumpError(error);
		}
	});

	async function validateUserOnline(socket, userid, sessionid, userkey){
		userOnline = await Lobby.IsUserOnline(userid, sessionid, userkey);
		return userOnline;
	}

	async function CheckLogin(io, socket, packet, next){

		try{
			// if (Login already)
			// else (Not Login yet)
			if(socket.hasOwnProperty('user')){
				console.log("===== Has Property");
				if(socket.user.sessionid == undefined || socket.user.userkey == undefined)
					throw Error("User Sessionid or Userkey cannot be found in socket");

				let userOnlineData = await validateUserOnline(socket, socket.user.userid, socket.user.sessionid, socket.user.userkey);
				if(!userOnlineData) throw Error("user_is_not_logged_in");
				
				return next();		
			}else{
				console.log("===== No Has Property");
				console.log("==== packet ", packet);
					if(packet[1].hasOwnProperty('userid') && packet[1].hasOwnProperty('sessionid') && packet[1].hasOwnProperty('userkey')){
						console.log("===== HAS DATA ");
						console.log("===== Rooms.client : ", Rooms.clients);
						// Cek User dope login
						let client_find = Rooms.clients.find(c => c.userid == packet[1].userid && (c.sessionid != packet[1].sessionid || c.userkey != packet[1].userkey));
						console.log("===== client_find ", client_find);
						if(client_find != undefined) {
							io.sockets.sockets[client_find.socketid].disconnect();
						}
						
						let userOnlineData = await validateUserOnline(socket, packet[1].userid, packet[1].sessionid, packet[1].userkey);

						if (!userOnlineData) throw Error("user_is_not_logged_in");

						socket.user = new Rooms.Client(socket.request.connection.remoteAddress, socket.id, false, packet[1].tableid, packet[1].userid, userOnlineData.username, packet[1].sessionid, packet[1].userkey, userOnlineData.avatar);
						Rooms.PushClient(socket.user);
						return next();
					}else{
						console.log("===== NO HAS DATA");
						throw Error("User has not login yet thus cannot emit anything");
					}
			}
		}catch(err){
			// console.log(err);
			throw Error(err);
		}
	}



});

function StringToNumArray(cards){
	if(cards == "" || !cards) return [];
	return cards.split(',').map(Number);
}
