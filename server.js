var isUseHTTPs = true && !(!!process.env.PORT || !!process.env.IP);
var port = process.env.PORT || 9001;

try 
{
    var _port = require('./config.json').port;

    if (_port && _port.toString() !== '9001') 
    {
        port = parseInt(_port);
    }
} 
catch (e) {}

var server = require(isUseHTTPs ? 'https' : 'http');
var url = require('url');
var path = require('path');
var fs = require('fs');

var app;

//users of chat room
var users = [];

if (isUseHTTPs) 
{
    var options = 
    {
        key: fs.readFileSync(path.join(__dirname, 'fake-keys/privatekey.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'fake-keys/certificate.pem'))
    };
    app = server.createServer(options, serverHandler);
} 
else app = server.createServer(serverHandler);

app = app.listen(port, process.env.IP || '0.0.0.0', function() 
{
    var addr = app.address();

    if (addr.address === '0.0.0.0') 
    {
        addr.address = ' 10.102.234.228';
		//addr.address = 'localhost';
    }

    console.log('Server listening at ' + (isUseHTTPs ? 'https' : 'http') + '://' + addr.address + ':' + addr.port);
});

require('./Signaling-Server.js')(app, function(socket) 
{
    try 
    {
        var params = socket.handshake.query;

        // "socket" object is totally in your own hands!
        // do whatever you want!

        // in your HTML page, you can access socket as following:
        // connection.socketCustomEvent = 'custom-message';
        // var socket = connection.getSocket();
        // socket.emit(connection.socketCustomEvent, { test: true });

        //when users sent to any user, processing events
        socket.on('chat_conn', function (raw_msg) 
        {
            var msg = JSON.parse(raw_msg);
            var channel = '';
            if(msg['channel'] != undefined) 
            {
                channel = msg['channel'];
            }
            socket.set('workspace', msg.workspace);
            var index = users.indexOf(msg.chat_id);
            if (index != -1) 
            {
                socket.emit('chat_fail', JSON.stringify(msg.chat_id));
            } 
            else 
            {
                users.push(msg.chat_id);
                socket.broadcast.emit('chat_join', JSON.stringify(users));
                socket.emit('chat_join', JSON.stringify(users));
            }
            console.log(users);
        });

        //Processing conditions of the time the user came out the chat room
        socket.on('leave', function (raw_msg) 
        {
            var msg = JSON.parse(raw_msg);
            if (msg.chat_id != '' && msg.chat_id != undefined) 
            {
                var index = users.indexOf(msg.chat_id);
                users.splice(index, 1);
            }
            socket.emit('refresh_userlist', JSON.stringify(users));
            socket.broadcast.emit('refresh_userlist', JSON.stringify(users));
        });

        //conditions when the user sent the message
        socket.on('heartbeat', function (raw_msg) 
        {
            var msg = JSON.parse(raw_msg);
            console.log(msg.to);
            socket.broadcast.emit('heartbeat', JSON.stringify(msg));
        });

    } 
    catch (e) {}
});;

function serverHandler(request, response) 
{
    try 
    {
        var uri = url.parse(request.url).pathname;
        var filename = path.join(process.cwd(), uri);

        if (filename && filename.search(/server.js|Scalable-Broadcast.js|Signaling-Server.js/g) !== -1) 
        {
            response.writeHead(404, {
                'Content-Type': 'text/plain'
            });
            response.write('404 Not Found: ' + path.join('/', uri) + '\n');
            response.end();
            return;
        }

        try 
        {
            var stats = fs.lstatSync(filename);

            if (filename && filename.search(/chat/g) === -1 && stats.isDirectory()) 
            {
                response.writeHead(200, {
                    'Content-Type': 'text/html'
                });
                response.write('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/chat/"></head><body></body></html>');
                response.end();
                return;
            }
        } 
        catch (e) 
        {
            response.writeHead(404, {
                'Content-Type': 'text/plain'
            });
            response.write('404 Not Found: ' + path.join('/', uri) + '\n');
            response.end();
            return;
        }

        if (fs.statSync(filename).isDirectory()) 
        {
            response.writeHead(404, {
                'Content-Type': 'text/html'
            });

            filename = filename.split('\\').join('/');
            if (filename.indexOf('/chat/MultiRTC/') !== -1) 
            {
                filename = filename.replace('/chat/MultiRTC/', '');
                filename += '/chat/index.html';
            } 
            else if (filename.indexOf('/chat/') !== -1) 
            {
                filename = filename.replace('/chat/', '');
                filename += '/chat/index.html';
            } 
            else 
            {
                filename += '/chat/index.html';
            }
        }

        fs.readFile(filename, 'utf8', function(err, file) 
        {
            if (err) 
            {
                response.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                response.write('404 Not Found: ' + path.join('/', uri) + '\n');
                response.end();
                return;
            }

            response.writeHead(200);
            response.write(file, 'utf8');
            response.end();
        });
    } 
    catch (e) 
    {
        response.writeHead(404, {
            'Content-Type': 'text/plain'
        });
        response.write('<h1>Unexpected error:</h1><br><br>' + e.stack || e.message || JSON.stringify(e));
        response.end();
    }
}