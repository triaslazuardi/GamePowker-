exports.InstanceCard =async function (_numplayers){
	let DeckCard = exports.Deal(_numplayers);
	console.log("=== CP1 === : ", DeckCard);
	// console.log("=== CP1 === : ", DeckCard["card"+"1"]);
	
	let allTypeCard = [];
	let playerTypeCard = [];
	let cardtabel = [];
	let i = 0;

	while (i < 5){
		cardtabel.push(DeckCard["card"+(i+1)]);
		i++
	}

	allTypeCard.TableCard = {Card : cardtabel, TranslateCard:exports.Transcard(cardtabel)};
	console.log("===== card table ===== : ", cardtabel);

	i = 0;
	while(i < _numplayers){
		let carddefault = [];
		let sevencard = [];
		for(let i_c = 0; i_c < 2; i_c++){
			carddefault.push(DeckCard['p'+(i+1)+'card'+(i_c+1)]);
			sevencard.push(DeckCard['p'+(i+1)+'card'+(i_c+1)]);
		}

		for(let i_sc = 0; i_sc < 5; i_sc ++){
			sevencard.push(cardtabel[i_sc])
		}

		let player_info = await exports.EvaluateHand(sevencard);

		playerTypeCard.push([i, {ValueCard: player_info["value"], DefaultCard: carddefault, AllCard: sevencard, TypeCard: player_info["type"], TranslateCard: exports.Transcard(sevencard)}]);
		i++;	
	}

	console.log("===== ALL TYPE CARD NO SHORT ===== : ", allTypeCard);
	console.log("===== ALL TYPE CARD NO SHORT ===== : ", playerTypeCard);

	playerTypeCard = playerTypeCard.sort(function(a, b){return b[1]["ValueCard"] - a[1]["ValueCard"] });

	i =0;
	while(i < _numplayers){
		// allTypeCard.PlayerCard[i] = {};
		// allTypeCard.PlayerCard[i] = playerTypeCard[i][1]; 
		// console.log(">>>> : " , playerTypeCard[i][1]);
		playerTypeCard[i].splice(0, 1);
		i++
	}
	allTypeCard.PlayerCard = playerTypeCard
	console.log("===== ALL TYPE CARD SHORT ===== : ", playerTypeCard);

	console.log("===== ALL TYPE ===== : ", allTypeCard);
 

}


// exports.Deal = function (numplayers, rounds) {
	exports.Deal = function (numplayers) {
    console.log("numplayers : "+ numplayers);
    console.log("Draw Card");
    // let cards = ['FD','2D','3D','4D','5D','6D','7D','8D','9D','10D','JD','QD','KD','AD', //13
	// 			 '2C','3C','4C','5C','6C','7C','8C','9C','10C','JC','QC','KC','AC',         //26
	// 			 '2H','3H','4H','5H','6H','7H','8H','9H','10H','JH','QH','KH','AH',         //39
	// 			 '2S','3S','4S','5S','6S','7S','8S','9S','10S','JS','QS','KS','AS'];        //52

     let cardpos = ['card1','card2','card3','card4','card5','p1card1','p1card2','p2card1',
             	 'p2card2','p3card1','p3card2','p4card1','p4card2','p5card1','p5card2',
             	 'p6card1','p6card2','p7card1','p7card2','p8card1','p8card2','p9card1',
				  'p9card2','p10card1','p10card2'];
	
	
	let numcards = (numplayers * 2) + 5;
	let deckcard ={}
	let deck_size = 52; 
	let shuffledCards = [];
	let i = 0;
	
	while(i < deck_size) {
		shuffledCards.push(i + 1);
		i++;
	}         

	i = shuffledCards.length-1;
	while(i>0) {
		let currentCard = shuffledCards[i];
		let otherCardIndex = MtRand(0, i)

		shuffledCards[i] = shuffledCards[otherCardIndex];
		shuffledCards[otherCardIndex] = currentCard;
		i--;
	}

	i =0;
	while(i < numcards) {
		// ----------------------- Cheat -------------------------------------------------
		
		// if(rounds%2 == 0) {
			// if(i == 0) deckcard[cardpos[i]] = 50; 
			// if(i == 1) deckcard[cardpos[i]] = 51;
			// if(i == 2) deckcard[cardpos[i]] = 48;
			// if(i == 3) deckcard[cardpos[i]] = 49;
			// if(i == 4) deckcard[cardpos[i]] = 46;
			// if(i == 5) deckcard[cardpos[i]] = 40;
			// if(i == 6) deckcard[cardpos[i]] = 41;
			// if(i == 7) deckcard[cardpos[i]] = 42;
			// if(i == 8) deckcard[cardpos[i]] = 43;
			// if(i == 9) deckcard[cardpos[i]] = 18;
			// if(i == 10) deckcard[cardpos[i]] = 19;
		// }else {
		// 	if(i == 0) deckcard[cardpos[i]] = 33;
		// 	if(i == 1) deckcard[cardpos[i]] = 26;
		// 	if(i == 2) deckcard[cardpos[i]] = 16;
		// 	if(i == 3) deckcard[cardpos[i]] = 17;
		// 	if(i == 4) deckcard[cardpos[i]] = 13;
		// 	if(i == 5) deckcard[cardpos[i]] = 49;
		// 	if(i == 6) deckcard[cardpos[i]] = 14;
		// 	if(i == 7) deckcard[cardpos[i]] = 5;
		// 	if(i == 8) deckcard[cardpos[i]] = 22;
		// 	if(i == 9) deckcard[cardpos[i]] = 10;
		// 	if(i == 10) deckcard[cardpos[i]] = 52;
		// }
		
		
		// i++;
		// continue;
// ----------------------- End Cheat -------------------------------------------------
		deckcard[cardpos[i]] = shuffledCards[i];
		i++;
	}

	return deckcard;
}

function MtRand (min, max) {
	min = Math.ceil(min);
    max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function InArray (elem, arr) {
	for (var i = 0; i < arr.length; i++) {
		if (arr[i] == elem){
			return true;
        }
	}
	return false;
}

function StringToNumArray(cards){
	if(cards == "" || !cards) return [];
	return cards.split(',').map(Number);
}

function array_count_values(arr){
	// console.log("------------ IS arr : ", arr);
	var dic = {};
	for (var key in arr) {
		dic[arr[key]%13] = (dic[arr[key]%13]) ? dic[arr[key]%13] + 1 : 1;
	}
	return dic;
}

function card_in_array (elem, arr) {
	for (var i = 0; i < arr.length; i++) {
		if (arr[i]%13 == elem%13){
			return elem;
        }
	}
	return false;
}

function ArrayToString(array){
	let str = "";
	for(let index_b = 0; index_b < array.length; index_b++){
		if(str != "") str += ",";
		str += array[index_b];
	}
	if(str == "") str = "-";
	return str;
}


// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = Card Validation = = = = = = = = = = = = = = = = = = = = = = = = = = = =
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
// function Transcard(array){
exports.Transcard = function(array){
    var cards = ['FD','2D','3D','4D','5D','6D','7D','8D','9D','10D','JD','QD','KD','AD', //13
				 '2C','3C','4C','5C','6C','7C','8C','9C','10C','JC','QC','KC','AC',         //26
				 '2H','3H','4H','5H','6H','7H','8H','9H','10H','JH','QH','KH','AH',         //39
				 '2S','3S','4S','5S','6S','7S','8S','9S','10S','JS','QS','KS','AS'];
    var resCard=[]
    for (var i = 0; i < array.length; i++){
        // resCard[i]=cards[array[i]];
        resCard.push(cards[array[i]]);
    }
    if (array.length == 1){
        return cards[array[0]];
    }else{
		console.log("fahshagfsghashagshgasga ", resCard);
        return resCard;
    }
}

const card_power = [0,1,5,9,13,17,21,25,29,33,37,41,45,49,2,6,10,14,18,22,26,30,34,38,42,46,50,3,7,11,15,19,23,27,31,35,39,43,47,51,4,8,12,16,20,24,28,32,36,40,44,48,52];
                 //['FD','2D[1]','3D[5]','4D[9]','5D[13]','6D[17]','7D[21]','8D[25]','9D[29]','10D[33]','JD[37]','QD[41]','KD[45]','AD[49]',
                 //'2C[2]','3C[6]','4C[10]','5C[14]','6C[18]','7C[22]','8C[26]','9C[30]','10C[34]','JC[38]','QC[42]','KC[46]','AC[50]',
                 //'2H'[3],'3H[7]','4H[11]','5H[15]','6H[19]','7H[23]','8H[27]','9H[31]','10H[35]','JH[39]','QH[43]','KH[47]','AH[51]',
                 //'2S[4]','3S[8]','4S[11]','5S','6S','7S','8S','9S','10S','JS','QS','KS','AS']


exports.EvaluateHand = async function(cards){
    // console.log("---- card table: " + cards);
    // console.log("---- card table: " + exports.Transcard(cards));
	let cardPlayer = [cards[0], cards[1]]
	cardPlayer.sort((a,b) => (b - a));
	cards.sort((a,b) => (a%13==b%13)?a-b:((a%13)==0?13:a%13) - ((b%13)==0?13:b%13));
	let cardOriginal = cards;

	// let cardTable = [cards[2], cards[3], cards[4], cards[5], cards[6]]
 // console.log("---- card table: " + cardTable);

	let isPair = array_count_values(cards);
	// console.log("------------ IS PAIR : ", isPair);
	let j = 0;
	let cardPair= [];
	let cardSingle= [];
	let cardCek= [];
	let cardValue= [];

	// console.log("---- isPair: ", isPair);
	// console.log("---- isPair: ", isPair.length);

	for(let i = 0; i < 14; i++){  // pisahin card yang sama
		if(!isPair[i]) continue;
		if(isPair[i] == 1) continue;
		for (let x = 0; x < cardOriginal.length; x++){
			if(i == cardOriginal[x]%13){
				cardPair[j] = cardOriginal[x];
				j++
			}
		}
	}
	// console.log("---- card pair: ", cardPair);

	j=0;
	for(let i = 0; i < cardOriginal.length; i++){ // pisahin card yang single
		if(!card_in_array(cardOriginal[i], cardPair)){
			cardSingle[j]= cardOriginal[i];
			j++;
		}
	}

	if(cardPair.length == 3){ // straight
		cardCek = [];
		cardCek[0] = cardPair[0]; cardCek[1] = cardPair[1]; cardCek[2] = cardPair[2]; cardCek[3] = cardSingle[cardSingle.length - 1]; cardCek[4] = cardSingle[cardSingle.length - 2];
		cardValue[cardValue.length] = exports.HandType(cardCek);
	}

    if (cardPair.length == 5){ // fulhouse
		cardValue[cardValue.length] = exports.HandType(cardPair);
		return cardValue[0];
	}

	if(cardPair.length != 3 && cardPair.length <=2 || cardPair.length >= 4 ){
		cardCek = []; j=0; let k = 0;
		// let countHightCardInPlayer = 0;
		for (let x = 0; x < 5; x++){  // FOR PAIR
			if(cardPair[j] != undefined){
				cardCek[x] = cardPair[j];
				j++;
			}else{
				k++
				cardCek[x] = cardSingle[cardSingle.length - (k)];
			}
		}
		cardValue[cardValue.length] = exports.HandType(cardCek);
		cardCek = []
	}

	j = 0;
	for(let x = 0; x < 7; x++){ // cekAll
		if(cardPair.length == 0) continue;
		if(cardPair.length == 5) continue;
		// if(cardPair.length == 2){
		if(cards[x] == cardPair[j]){
			cardCek=[];
			let cardX = ArrayToString(cards);
			cardCek = StringToNumArray(cardX);
			cardCek.splice(x, 1, );
			cardValue[cardValue.length] = exports.HandType(cardCek);
			cardValue[cardValue.length] = exports.HandType(cardCek.sort((a, b) => (b - a)));
			j++;
		}
	}

	cardValue[cardValue.length] = Cek_Hight_Card(cards);
	cardValue[cardValue.length] = Cek_Hight_Card(cards.sort((a, b) => (b - a)));

	cardValue.sort((a, b) => (b.value - a.value));
	console.log("rankvalue 2 > ", cardValue[0]);
	return cardValue[0];
}


function Cek_Hight_Card(cards) {
    let oriCard = cards.toString();
    let card = [];
    let cardLoop = [];
    let rankValue = [];
    let cekCard = [];
    let rankCard = [];

    if(cards.length > 4){

        for (var i=0; i < cards.length; i++){
                for (var a = 0; a < 5;a++){
                    if(i == 0){
                        for (var b = 0; b < cards.length; b++){
                            cardLoop[b]=cards[b];
                            card[b]= cards[b]
                        }
                    }else {
                        for (var b = 0; b < cards.length; b++){
                            cardLoop[b]=card[b];
                        }
                    }
                    cekCard[a]= card[a];
                }
                rankCard[i]= cekCard.toString();
                rankValue[i]= exports.HandType(cekCard);
                rankValue[i].cards = StringToNumArray(rankCard[i]);

                for (var b = 0; b < cards.length; b++){
                    if (b == 6){
                        card[6]=cardLoop[0];
                    }else{
                        card[b] = cardLoop[(b+1)];
                    }
                }
        }

		let x = 0;

		while (x < rankValue.length){
			if(rankValue[x] == -1){
				rankValue.splice(x, 1, );
				x = 0;
			}else {
				x++;
			}
		}

        rankValue.sort((a, b) => (b.value - a.value));
		if(rankValue[0] == undefined){
			return -1;
		}
        return rankValue[0];
    }
}

exports.HandType = function(card) {
    card.sort((a,b) => (a%13==b%13)?a-b:((a%13)==0?13:a%13) - ((b%13)==0?13:b%13));
	let cardN = [];
	for(let i_c = 0; i_c < card.length; i_c++){
		cardN[i_c] = card[i_c]%13;
		if(cardN[i_c] == 0) cardN[i_c] = 13;
	}



	let i_a = 0;
	let i_b = 0;
	let v_a = 0;
	let v_b = 0;

	// console.log("Royal Flush"); // A,K,Q,J,10
	// console.log("======================= card ", card);
	// console.log("======================= cardn ", cardN);
	// console.log("======================= 1212121 " + cardN.indexOf(10));
    if(cardN.indexOf(12) > -1){ // There is 'A'
     if(card.indexOf(card[cardN.indexOf(13)]-1) > -1 && card.indexOf(card[cardN.indexOf(13)]-2) > -1 && card.indexOf(card[cardN.indexOf(13)]-3) > -1 && card.indexOf(card[cardN.indexOf(13)]-4) > -1){
      return {type: "Royal Flush", value: 900 + card_power[card[cardN.indexOf(12)]], cards:card, hand:exports.Transcard(card)};
     }
    }

	// console.log("Straight Flush");
	// = = = = = = = = Straight Flush = = = = = = = =
	if(cardN.indexOf(13) > -1) { // There is '2'
		if(cardN.indexOf(1) > -1){ // There is 'A'
			if(card.indexOf(card[cardN.indexOf(13)]-12) > -1 && card.indexOf(card[cardN.indexOf(13)]-11) > -1 && card.indexOf(card[cardN.indexOf(13)]-10) > -1){
				return {type: "Straight Flush", value: 800 + card_power[card[cardN.indexOf(13)]-10], cards:card, hand:exports.Transcard(card)};
			}
		}else{
			if(card.indexOf(card[cardN.indexOf(13)]-12) > -1 && card.indexOf(card[cardN.indexOf(13)]-11) > -1 && card.indexOf(card[cardN.indexOf(13)]-10) > -1 && card.indexOf(card[cardN.indexOf(13)]-9) > -1){
				return {type : "Straight Flush", value :800 + card_power[card[cardN.indexOf(13)]-9], cards:card, hand:exports.Transcard(card)};
			}
		}
	}else{
		if(card[1] == card[0]+1 && card[2] == card[0]+2 && card[3] == card[0]+3 && card[4] == card[0]+4){
			return {type : "Straight Flush", value: 800 + card_power[card[4]], cards:card, hand:exports.Transcard(card)};
		}
	}
	// = = = = = = = = End Straight Flush = = = = = = = =


	// console.log("Four of a kind");
	// = = = = = = = = Four of a kind = = = = = = = =
	i_a = 0;
	i_b = 0;
	v_a = [];
	v_a[0] = card[0];
	v_b = [];
	for(let i_c = 0; i_c < card.length; i_c++){
		if(v_a[0]%13 == card[i_c]%13){
			v_a[i_a] = card[i_c];
			i_a++;
		}else{
			if(v_b.length > 0) {
				if(v_b[0]%13 == card[i_c]%13){
					v_b[i_b] = card[i_c];
					i_b++;
				}else{
					v_b[i_b] = card[i_c];
					i_b = 1;
				}
			}else{
				v_b[i_b] = card[i_c];
				i_b = 1;
			}
		}
	}
	if ((i_a == 1 && i_b == 4) || (i_a == 4 && i_b == 1)){
		if(i_a == 4) return {type: "Four of a Kind", value: 700 + card_power[v_a[v_a.length-1]], cards:card, hand:exports.Transcard(v_a)};
		else return {type: "four of a Kind", value: 700 + card_power[v_b[v_b.length-1]], cards:card, hand:exports.Transcard(v_b)};
	}
	// = = = = = = = = End Four of a kind = = = = = = = =


	// console.log("Fullhouse");
	// = = = = = = = = Fullhouse = = = = = = = =
	i_a = 0;
	i_b = 0;
	v_a = [];
	v_a[0] = card[0];
	v_b = [];
	for(let i_c = 0; i_c < card.length; i_c++){
		if(v_a[0]%13 == card[i_c]%13){
			i_a++;
			v_a[i_c] = card[i_c];
		}else{
			if(v_b.length > 0) {
				if(v_b[0]%13 == card[i_c]%13){
					v_b[i_b] = card[i_c];
					i_b++;
				}else{
					v_b[i_b] = card[i_c];
					i_b = 1;
				}
			}else{
				v_b[i_b] = card[i_c];
				i_b = 1;
			}
		}
	}

	if ((i_a == 2 && i_b == 3) || (i_a == 3 && i_b == 2)){
		if(i_a == 3) return {type : "Fullhouse", value : 600 + card_power[v_a[v_a.length-1]], cards:card, hand:exports.Transcard([v_a[0], v_a[1], v_a[2], v_b[0], v_b[1]])};
		else return {type : "Fullhouse", value : 600 + card_power[v_b[v_b.length-1]], cards:card, hand:exports.Transcard([v_b[0], v_b[1], v_b[2], v_a[0], v_a[1]])};
	}
	// = = = = = = = = End Fullhouse = = = = = = = =


	// console.log("Flush");
	// = = = = = = = = Flush = = = = = = = =
	v_a = Math.ceil(card[0]/13);
	if(v_a == Math.ceil(card[1]/13) && v_a == Math.ceil(card[2]/13) && v_a == Math.ceil(card[3]/13) && v_a == Math.ceil(card[4]/13)){
		// return {type : "Flush", value :500 + card_power[card[4]], cards:card, hand:exports.Transcard(card)};
		// return {type : "Flush", value :500 + ((((card_power[card[0]])/2)+((card_power[card[4]])/2))/2), cards:card, hand:exports.Transcard(card)};
		return {type : "Flush", value :500 + ((card_power[card[0]] + card_power[card[1]] + card_power[card[2]] +card_power[card[3]] + card_power[card[4]])/5), cards:card, hand:exports.Transcard(card)};
	}
	// = = = = = = = = End Flush = = = = = = = =


	// console.log("Straight");
	// = = = = = = = = Straight = = = = = = = =
	if(cardN.indexOf(13) > -1) { // There is 'A'
		if(cardN.indexOf(1) > -1){ // There is '2'
			if(cardN.indexOf(2) > -1 && cardN.indexOf(3) > -1 && cardN.indexOf(4) > -1){ // There is '3,4,5'
				return {type : "Straight", value : 400 + card_power[card[cardN.indexOf(3)]], cards:card, hand:exports.Transcard(card)};
			}
		}else{
			if(cardN.indexOf(1) > -1 && cardN.indexOf(2) > -1 && cardN.indexOf(3) > -1 && cardN.indexOf(4) > -1){ // There is '3,4,5,6'
				return {type : "Straight", value: 400 + card_power[card[cardN.indexOf(4)]], cards:card, hand:exports.Transcard(card)};
			}
		}
	}
	if(cardN[1] == cardN[0]+1 && cardN[2] == cardN[0]+2 && cardN[3] == cardN[0]+3 && cardN[4] == cardN[0]+4){
		return {type:"Straight", value: 400 + card_power[card[4]], cards:card, hand:exports.Transcard(card)};
	}
	// = = = = = = = = End Straight = = = = = = = =

    // = = = = = = = = thre of a kind, two pair, one pair = = = = = =
    i_a = 0;
    i_b = 0;
    i_x = 0;
	v_a = [];
    v_b = []; // yang dibuang

	for(let i_c = 0; i_c < card.length; i_c++){
		if(card[i_c]%13 == card[i_c+1]%13){
            (v_a[i_a] == undefined) ? v_a[i_a] = card[i_c] : v_a[i_a+1] = card[i_c];
            (v_a[i_a+1] != card[i_c]) ? v_a[i_a+1] = card[i_c+1] : v_a[i_a+2] = card[i_c+1];
            if(card[i_c]%13 == card[i_c+2]%13){
                v_a[i_a+2] = (v_a[i_a+2] == undefined) ? card[i_c+2]:v_a[i_a+2];
                i_a += 2;
            }else {
                i_a++;
            }
        }else {
            if(card[i_c]%13 != card[i_c-1]%13 && card[i_c]%13 != card[i_c+1]%13 ){
                v_b[i_b]= card[i_c];
                i_b++;
            }

        }
	}
	// console.log("weeeeee v_a : ", v_a);
	// console.log("weeeeee v_b : ", v_b);
	// console.log("weeeeee i_a : ", i_a);
	// console.log("weeeeee i_b : ", i_b);

	if (i_a == 3 || i_a == 2 || i_a == 1){
		if(i_a == 3) return {type: "Three Of A Kind", value: 300 + card_power[v_a[3]] + ((card_power[v_b[0]]+card_power[v_b[1]])/2), cards:card, hand:exports.Transcard([v_a[1]])};
		if(i_a == 2) return {type: "Two Pair", value: 200 + ((card_power[v_a[1]]+card_power[v_a[3]])/2)+card_power[v_b[0]], cards:card, hand:exports.Transcard([v_a[1], v_a[2]])};
		if(i_a == 1) return {type: "One Pair", value: 100 + ((card_power[v_a[0]] + card_power[v_a[1]]) +((card_power[v_b[0]]/2)+(card_power[v_b[1]]/2)+ (card_power[v_b[2]]/2))/3)/2, cards:card, hand:exports.Transcard([v_a[1]])};
	}
// = = = = = = = = END thre of a kind, two pair, one pair = = = = = =
//
    // console.log("high Card")
    var hcPoint = (card_power[card[0]] + card_power[card[1]] + card_power[card[2]]+card_power[card[3]]+card_power[card[4]])/100;
    return {type:"High Card", value: hcPoint, cards:card, hand:exports.Transcard([card[4]])};

    return (-1);
}
