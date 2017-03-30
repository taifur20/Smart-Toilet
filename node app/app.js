//importing required modules
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http); //creates a new socket.io instance attached to the http server
var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var path = require('path');
path.join(__dirname, '/root/smart-toilet')
//routes the index.html file
app.get('/', function(req, res){
	//res.sendfile('./index.html');
	res.sendFile(__dirname + '/index.html');
});

//setup serial port
var sp = new SerialPort("/dev/ttyS0", { //for serial communication with arduino chip 
    baudrate: 57600,  
    parser: serialport.parsers.readline("\n")
});

//required global variables
var total_clients = 0;
var connected_clients_id = [];
var flag = 0;
var engaged = false;
var button_flag = 0;

//triggers when connected to serial port 
sp.on("open", function () {
	//trigger on connection to any client
    io.on('connection', function(socket){
	console.log('A user connected (id=' +socket.id + ').');
	
	//In order to send an event to everyone, Socket.IO gives us the io.emit:

    //this function is triggered on any serial data received
	sp.on('data', function(data) {
            console.log("Serial port received data:" + data);
            //data gets split by " " to get the values and stored in result array
            var result=data.split(" ");
			var temperature = result[1];
			var humidity = result[2];
			var air_quality = result[3];
			var distance = result[4];
			var water = result[5];
			var air_status; var water_supply; var toilet_status;
			if(air_quality == 3)  air_status = 'Fresh Air';
			else if(air_quality == 2)  air_status = 'Low Pollution';
			else if(air_quality == 1)  air_status = 'High Pollution';
			//I am taking a random value set to arduino program to sense water sypply
			//30 means nothing, you can use your own value and should be set to arduino program
			if(water>30) water_supply = 'Available';
			else water_supply = 'Not Available';
			//flag variable is used to track either a person used the toilet or not
			if(distance<10) {toilet_status = 'Engaged'; flag = 1; engaged = true; if(button_flag){total_clients++; button_flag = 0;}}
			//if(distance<10 && flag==1) toilet_status = 'Engaged';
			else if(distance>20 && total_clients<1) toilet_status = 'Available';
			else if(distance>20 && total_clients>=1) {toilet_status = 'Engaged'; if(button_flag) total_clients++; }
			//socket.emit sends data to all client in JSON format
			socket.emit('update', { temp: temperature.toString()+'C', humid: humidity+'%', air: air_status, 
									stat: toilet_status, per: (total_clients-1).toString()+' Persons', water: water_supply});
			//the distance may be changed for your case
			//and depends on the sensor placement and room sizeToContent
			//adjust it according to your requirement
			if(distance>20 && flag==1) {
				//after sending a request a toilet will be engaged immediately and will be available againg
				//after user's entering and then outgoing, flag==1 when engaged and distance>20 when free again
				flag = 0; engaged = false; button_flag = 0;
				io.to(connected_clients_id[0]).emit('info', 'it is your time');
				connected_clients_id.splice(0, 1);
				if(total_clients>0)total_clients--;
				socket.emit('person', { per: (total_clients-1).toString()+' Persons'});
			}
    });
	
	//Receive a message from client side
	socket.on('serialButton', function(data){
		console.log(data);
		
		//Store the id of new client to an array
		var index = connected_clients_id.indexOf(socket.id);
		// if he is the first user and toilet is available
		if(total_clients==0 && engaged==false){ 
			io.to(socket.id).emit('free', {click: '0'});
			//status changed to engaged after clicking the serial button
			toilet_status = 'Engaged';
			total_clients++;
		}
		// when first user enter the system and found toilet engaged
		else if(total_clients==0 && engaged==true){
			//then his id is added to the queue
			connected_clients_id.push(socket.id);
			total_clients++;
			button_flag = 1; //keeps trac either user click to the button
			socket.emit('person', { per: (total_clients).toString()+' Persons'});
		}
		else if(index != -1){
			//if already any user click the serial button then check here either this click is from 
			//a different user or not. If same user click to the serial button multiple times his first
			//request will be considered only
			if(search(socket.id, connected_clients_id)){
				//request sent to specific client with client id 
				io.to(socket.id).emit('notice', 'You already sent a request');
			}
			else{
				connected_clients_id.push(socket.id);
				total_clients++;
				//number of client waiting = total client - 1
				//because one client will be in service 
				socket.emit('person', { per: (total_clients-1).toString()+' Persons'});
			}
		}
		else{
			connected_clients_id.push(socket.id);
			total_clients++;
			socket.emit('person', { per: (total_clients-1).toString()+' Persons'});
		}
	});
	//when a client click to cancel button his id will be removed from the list
	socket.on('cancelButton', function(data){
		console.log(data);
		var index = connected_clients_id.indexOf(socket.id);
		if(index != -1){
			console.log('A user disconnected (id =' +socket.id + ')');
			//remove the id of disconnected client from the array
			connected_clients_id.splice(index, 1);
			total_clients--;
		}
		socket.emit('person', { per: (total_clients-1).toString()+' Persons'});
	});
	
	//Whenever some disconnects this piece of code executed
	socket.on('disconnect', function(){
		console.log('A user disconnected (id =' +socket.id + ')');
		var index = connected_clients_id.indexOf(socket.id);
		if(index != -1){
			console.log('A user disconnected (id =' +socket.id + ')');
			//remove the id of disconnected client from the array
			connected_clients_id.splice(index, 1);
			total_clients--;
		}
	});
  //end of io.on() function	
  }); 
//end of sp.on() function  
});
//here I chacked an id is already available in the array or not
function search(nameKey, myArray){
    for (var i=0; i < myArray.length; i++) {
        if (myArray[i] === nameKey) {
            return true;
        }
    }
	return false;
}

//Run server to listen on port 3000.
http.listen('3000', function(){
	console.log('listening on *:3000');
});

// When the client connects, they are sent a message
// socket.emit('message', 'You are connected!');
// The other clients are told that someone new has arrived
// socket.broadcast.emit('message', 'Another client has just connected!');
// In order to send an event to everyone, Socket.IO gives us the io.emit:
// io.emit('some event', { for: 'everyone' });
// To broadcast an event to all the clients io.sockets.emit
// io.sockets.emit('broadcast',{ description: clients + ' clients connected!'});
	//arr.push(socket);
	//clients++;
	//arr[clients-1].emit('testerEvent', { temp: "23.45C", humid: '60%', air: 'Good', stat: 'Available', per: '3 Persons', water: 'Available'});

//arr.includes(searchElement)

