//构架路由
//但被请求时返回leancloud的gh类的对应的数据
//路由的路径是/gh/:owner/:repo@:branch/:path
//引入依赖
var http = require("http");
var https = require("https");
//引入leancloud
const AV = require('leancloud-storage');
const {Query, User} = AV;
if (process.env.appId && process.env.appKey) {
    AV.init({
        appId: process.env.appId, appKey: process.env.appKey
    });
} else {
    AV.init({
        appId: "xxxxx", appKey: "xxxxx"
    });
}

//路由
http.createServer(function (req, res) {
    //路由的路径是/gh/:owner/:repo@:branch/:path
    if (req.url.indexOf('/gh/') === 0) {
        var url = req.url.split('/gh/')[1];
        if (url) {
            var urlArr = url.split('/');
            if (urlArr.length >= 3) {
                //获取owner，repo，branch，path
                var owner = urlArr[0], repoandbranch = urlArr[1], path = urlArr[2], repo = repoandbranch.split('@')[0];
                var repo = repoandbranch.split('@')[0];
                var branch = repoandbranch.split('@')[1];
                //查询数据
                var query = new AV.Query('gh');
                query.equalTo('owner', owner);
                query.equalTo('repo', repo);
                query.equalTo('branch', branch);
                query.equalTo('path', path);
                query.find().then((comments) => {
                    if (comments.length > 0) {
                        res.writeHead(200, {"Content-Type": "text/html;charset=utf-8"});
                        //设置返回数据编码为utf-8

                        //base64解码,解码后的数据是json格式的
                        let r = comments[0].get('file');
                        let data = Buffer.from(r, 'base64').toString('utf8');
                        res.write(//转换为utf-8
                            data);
                        res.end();
                    } else {
                        res.writeHead(404, {"Content-Type": "text/plain"});
                        res.write('Not found, or we don\'t have storage, you can access /api/' + url + ' to store data');
                        res.end();
                    }
                });
            } else {
                //输出网页
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.write('url mest be:/gh/:owner/:repo@:branch/:path');
                res.end();
            }
        } else {
            //输出网页
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.write('url mest be:/gh/:owner/:repo@:branch/:path');
            res.end();
        }
    } else if (req.url.indexOf('/api/') == 0) {
        //路由的路径是/api/:owner/:repo@:branch/:path
        var url = req.url.split('/api/')[1];
        if (url) {
            var urlArr = url.split('/');
            if (urlArr.length >= 3) {
                var owner = urlArr[0], repoandbranch = urlArr[1], path = urlArr[2]
                var repo = repoandbranch.split('@')[0];
                var branch = repoandbranch.split('@')[1];
                //查询数据
                var query = new AV.Query('gh');
                query.equalTo('owner', owner);
                query.equalTo('repo', repo);
                query.equalTo('branch', branch);
                query.equalTo('path', path);
                query.find().then((comments) => {
                    //请求数据
                    //API接口：https://api.github.com/repos/:owner/:repo/contents/:path?ref=:branch
                    var option = {
                        hostname: 'api.github.com',
                        path: '/repos/' + owner + '/' + repo + '/contents/' + path + '?ref=' + branch,
                        headers: {
                            'Accept': '*/*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
                            'Accept-Encoding': 'utf-8',  //这里设置返回的编码方式 设置其他的会是乱码
                            'Accept-Language': 'zh-CN,zh;q=0.8',
                            'Connection': 'keep-alive'

                        }
                    };
                    https.get(option, function (ress) {
                        //获取数据
                        var body = '';
                        //伪装User-Agent成浏览器，避免被github拒绝，res.setheader的方式不行

                        ress.setEncoding('utf8');
                        ress.on('data', function (chunk) {
                            body += chunk;
                        });
                        //获取数据完毕
                        ress.on('end', function () {
                            //解析数据
                            var data = JSON.parse(body);
                            //创建数据
                            if (data.content) {
                                //存储数据
                                var gh = new AV.Object('gh');
                                gh.set('owner', owner);
                                gh.set('repo', repo);
                                gh.set('branch', branch);
                                gh.set('path', path);
                                //时间戳
                                var time = new Date().getTime();
                                //设置时间戳为string类型
                                gh.set('time', time.toString());
                                //文件内容
                                //解码

                                var content = new Buffer(data.content, 'base64').toString();
                                gh.set('file', data.content);
                                gh.save().then(function () {
                                    res.writeHead(200, {"Content-Type": "text/plain"});
                                    res.write('success');
                                    res.end();
                                });
                            } else {
                                res.writeHead(404, {"Content-Type": "text/plain"});
                                res.write('is not a file on github');
                                res.end();
                            }
                        });
                    });
                });
            } else {
                //输出网页
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.write('url mest be:/api/:owner/:repo@:branch/:path');
                res.end();
            }
        } else {
            //输出网页
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.write('url mest be:/api/:owner/:repo@:branch/:path');
            res.end();
        }
    } else {
        //输出网页
        if (req.url === '/') {
            res.writeHead(200, {"Content-Type": "text/html"});
            res.write('<html lang="zh"><head><meta charset="utf-8"><title>CDN</title></head><body><h1>GitHub</h1><p>输入url:</p><p>/gh/:owner/:repo@:branch/:path</p></body></html>');
            res.end();
        } else {
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.write('url mest be:/gh/:owner/:repo@:branch/:path');
            res.end();
        }
    }
}).listen(80);