const express = require('express');
const http = require('http')
const path = require('path');
const socketio = require('socket.io');
const app = express();
var cors = require('cors')

app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
const server = app.listen(process.env.PORT || 5000, () => console.log(`Running on port: ${PORT}`));
const io = socketio(server).listen(server);
const { v4: uuidv4 } = require('uuid')
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PORT = 5000 || process.env.PORT;
dotenv.config();
function replace(str) {
    return str.split("").map(char => "a").join("");
}
/*
    Calculate score of the user according to coordinates input
*/
function score_calculate(lat, long, lat_ans, long_ans, time) {
    let score = 0;
    let dist = Number(Math.ceil(Math.sqrt(((lat - lat_ans) ** 2) + ((long - long_ans) ** 2))));
    console.log('dist is ', dist)
    if (dist < 2)
        score = 50 + time;
    else if (dist >= 2 && dist < 3)
        score = 40 + time;
    else if (dist >= 3 && dist <= 4)
        score = 30 + time;

    return score;

}

const { MongoClient } = require("mongodb");

// Replace the uri string with your MongoDB deployment's connection string.
const uri = "mongodb+srv://test123:test123@cguesscluster.xmwhw.mongodb.net/CguessDB?retryWrites=true&w=majority";

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
var dbdata = ''


//Fetch all the data from database
async function run() {
    try {
        await client.connect();

        const database = client.db('CguessDB');
        const collection = database.collection('Cities');

        const city = await collection.find().toArray();
        dbdata = city;
        
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}
run().catch(console.dir).then(() => {

    var rooms = []
    var roomno;
    // var roomno = uuidv4();
    io.on('connection', function (socket) {

        if (io.nsps['/'].adapter.rooms["room-" + roomno] && io.nsps['/'].adapter.rooms["room-" + roomno].length > 30) roomno = "1234567891";
        
        roomno = socket.handshake.query.key;
        socket.join("room-" + roomno);   
        socket.roomKey = roomno;     
        io.sockets.in("room-" + roomno).emit('connected', true);

        function countDown() {
            try {

                if (rooms["room-" + roomno]) {
                    if (rooms["room-" + roomno].scores.length === 0) {
                        console.log('Room Empty!!')
                    }
                }
                try {
                    //Round end logic
                    if (rooms["room-" + roomno].timer === 0) {
                        if (rooms["room-" + roomno].round > 0) {
                            rooms["room-" + roomno].markers = [];
                            io.sockets.in("room-" + roomno).emit('markers', rooms["room-" + roomno].markers);
                            io.sockets.to("room-" + roomno).emit('newmsg', {
                                message: 'The city was ' + rooms["room-" + roomno].city,
                                user: 'System'
                            });
                        }
                        rooms["room-" + roomno].timer = 60;
                        rooms["room-" + roomno].round += 1;
                        rooms["room-" + roomno].update = [];
                        //Game finished
                        if (rooms["room-" + roomno].round === 5) {
                            // try {
                            //     delete rooms["room-" + socket.roomKey];
                            // } catch (err) {
                            //     console.log("Room deleted already")
                            // }
                            io.sockets.in("room-" + roomno).emit('showresults', true);
                            // socket.disconnect();
                            // roomno = uuidv4();
                            return;
                        }

                        var randIndex = parseInt(Number(Math.random() * (dbdata.length - 1)), 10)
                        while (rooms["room-" + roomno].factIndex.includes(randIndex)) {
                            randIndex = parseInt(Number(Math.random() * (dbdata.length - 1)), 10)
                        }
                        console.log('INDEX IS' + randIndex)
                        console.log(dbdata[randIndex]['name']);
                        rooms["room-" + roomno].factIndex.push(randIndex)
                        rooms["room-" + roomno].currentFact = dbdata[randIndex]['img']
                        //extra added
                        rooms["room-" + roomno].city = dbdata[randIndex]['name']
                        rooms["room-" + roomno].lat = dbdata[randIndex]['lat']
                        rooms["room-" + roomno].long = dbdata[randIndex]['long']
                        rooms["room-" + roomno].update_done = []




                        console.log(rooms["room-" + roomno])
                        //  io.sockets.in("room-"+roomno).emit("newFact",rooms["room-"+roomno].currentFact);
                        io.sockets.in("room-" + roomno).emit('updates', {
                            city: replace(rooms["room-" + roomno].city),
                            currentFact: rooms["room-" + roomno].currentFact,
                            round: rooms["room-" + roomno].round,
                            timer: rooms["room-" + roomno].timer
                        });
                    }


                    rooms["room-" + roomno].timer -= 1;
                }
                catch (err) {
                    console.log(err)
                    return;
                }
                setTimeout(countDown, 1000);
            }
            catch (err) {
                return;
            }
        }
        //First time creation of room
        if (!rooms["room-" + roomno]) {
            rooms["room-" + roomno] = {
                scores: [],
                markers: [],
                //    users:[],
                currentFact: "Waiting For players to join the room!",
                timer: 0,
                city: Math.random().toString(36).substring(7),
                round: 0,
                factIndex: [],
                lat: 0,
                long: 0,
                update_done: []
            };

            // io.sockets.in("room-"+roomno).emit('updates',rooms["room-"+roomno]);
            countDown();
        }
        else {
            io.sockets.in("room-" + roomno).emit('updates', {
                city: replace(rooms["room-" + roomno].city),
                currentFact: rooms["room-" + roomno].currentFact,
                round: rooms["room-" + roomno].round,
                timer: rooms["room-" + roomno].timer
            });
        }

        //Send this event to everyone in the room.

        io.sockets.in("room-" + roomno).emit('connectToRoom', "You are in room no. " + roomno);



        socket.on('setUsername', function (data) {
            socket.playerName = data.username;
            // io.sockets.to("room-"+roomno).emit('joinMsg', {user: data.username});
            io.sockets.to("room-" + roomno).emit('userSet', { username: data.username });
            rooms["room-" + roomno][data.username] = Math.random();
            rooms["room-" + roomno].scores.push({ name: data.username, score: 0, avaterID: rooms["room-" + roomno][data.username] });

            io.sockets.in("room-" + roomno).emit('scores', rooms["room-" + roomno].scores);
            console.log(rooms)
        });

        socket.on('restart', function (data) {
            io.sockets.to("room-"+roomno).emit('hideothermodals',{})
            rooms["room-" + socket.roomKey].timer = 0;
            rooms["room-" + socket.roomKey].round = 0;

            let score_arr = rooms["room-" + roomno].scores;
            score_arr.forEach((dat , index) => {
            dat.score = 0;
            score_arr[index].score = 0;
            console.log(dat);
            io.sockets.to("room-" + roomno).emit('newscore', {
                username: dat.name,
                score: dat.score
            });
            rooms["room-" + roomno].update_done.push(socket.playerName);
            })
            countDown();
        });

        socket.on('msg', function (data) {
            //Send message to everyone
            console.log(data)
            try {
                io.sockets.to("room-" + roomno).emit('newmsg', {
                    message: data.message,
                    user: data.user,
                    avaterID: rooms["room-" + roomno][data.user]
                });
            } catch (err) {
                console.log(err);
            }
        })
        socket.on('mapclicked', (data) => {
            try {
                if (rooms["room-" + roomno].update_done.includes(socket.playerName)) {
                    console.log('Answer found in array!!')
                    return;
                }
                let lat_ans = Number(rooms["room-" + roomno].lat);
                let long_ans = Number(rooms["room-" + roomno].long);
                let time_left = Number(rooms["room-" + roomno].timer);
                let curr_score = score_calculate(Number(data.location.lat), Number(data.location.lng), lat_ans, long_ans, time_left)
                let topush = true;
                if (curr_score > 0) {
                    io.sockets.to("room-" + roomno).emit('newmsg', {
                        message: socket.playerName + ' chose the correct answer!',
                        user: 'System'
                    });
                    //remove marker from array
                    topush = false;



                }
                const marks = [...rooms["room-" + roomno].markers]
                if (marks.length === 0 && curr_score === 0 && topush)
                    rooms["room-" + roomno].markers.push(data);
                else {
                    var flag = 0
                    marks.forEach(element => {
                        if (element.username === data.username) {
                            element.location = data.location;
                            flag = 1;
                        }
                    });
                    if (flag === 0 && curr_score === 0 && topush) {
                        rooms["room-" + roomno].markers.push(data);
                    }
                    else {
                        rooms["room-" + roomno].markers = marks;
                    }
                }
                io.sockets.in("room-" + roomno).emit('markers', rooms["room-" + roomno].markers);

                console.log(socket.playerName + ' Clicked on map ' + data.location.lat + "  " + data.location.lng);
                console.log(curr_score)
                let score_arr = rooms["room-" + roomno].scores;
                score_arr.forEach((dat, index) => {
                    console.log(dat.name, dat.score)
                    if (dat.name === socket.playerName) {
                        console.log(socket.playerName)
                        if (curr_score != 0 && !(rooms["room-" + roomno].update_done.includes(socket.playerName))) {
                            console.log('Score Added to player', socket.playerName);
                            dat.score += curr_score;
                            score_arr[index].score += curr_score;
                            console.log("Inc score", dat.score)
                            io.sockets.to("room-" + roomno).emit('newscore', {
                                username: dat.name,
                                score: dat.score
                            });
                            rooms["room-" + roomno].update_done.push(socket.playerName);
                        }
                        else {
                            console.log('Already Updated!!!')
                        }


                    }
                })
                //calculate points of user --update in db :/
            } catch (err) {
                console.log("Map clicked error")
                console.log(err)
            }


        })

        socket.on('disconnect', (data) => {
            console.log('Disconnect fired!!')

            var x = socket.playerName;
            console.log('YOYOOYOYOYO')
            console.log(socket.playerName)
            try {
                const usersInRoom = rooms["room-" + socket.roomKey].scores.filter((item) => item.name !== socket.playerName);
                rooms["room-" + socket.roomKey].scores = usersInRoom;

                io.sockets.in("room-" + roomno).emit('scores', rooms["room-" + roomno].scores);
                const v = "room-" + socket.roomKey;
                console.log('This is room Key')
                console.log(v)
                if (rooms["room-" + socket.roomKey].scores.length === 0) {
                    console.log('deletion complete!')
                    delete rooms["room-" + socket.roomKey];
                }
            }
            catch (err) {
                console.log("room not available");
            }

            socket.disconnect();

        })

    })
}
);

