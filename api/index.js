//构架路由
//但被请求时返回leancloud的gh类的对应的数据
//路由的路径是/gh/:owner/:repo@:branch/:path
//引入依赖
const http = require("http");
const https = require("https");
const fs = require("fs");
const nodeurl = require("url");
//引入leancloud
const AV = require('leancloud-storage');
const {Query, User} = AV;
//环境变量
if (process.env.appId && process.env.appKey) {
    AV.init({
        appId: process.env.appId, appKey: process.env.appKey
    });
} else {
    AV.init({
        appId: "xxxxx", appKey: "xxxxx"
    });
}

//函数区
//获取github的数据
//保证以下函数可以被外部调用，并返回请求结果，所以需要promise
//获取github的数据并保存
function getGithubData(owner, repo, branch, path) {
    //获取github的数据
    return new Promise(function (resolve, reject) {
        //获取github的数据
        //在promise中使用https请求
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
        https.get(option, function (res) {
            //返回的数据
            let body = "";
            //每次读取数据
            res.on("data", function (chunk) {
                body += chunk;
            });
            //读取完毕
            res.on("end", function () {
                //创建数据
                var data = JSON.parse(body);
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
                    //判断时候重复
                    //保存数据
                    gh.set('file', data.content);
                    var query = new AV.Query('gh');
                    query.equalTo('owner', owner);
                    query.equalTo('repo', repo);
                    query.equalTo('branch', branch);
                    query.equalTo('path', path);
                    query.find().then(function (results) {
                        if (results.length > 0) {
                            //如果有数据，则更新数据，删除旧数据
                            let old = AV.Object.createWithoutData('gh', results[0].id);
                            old.destroy();
                            gh.save().then(function () {
                                var ext = path.split('.')[path.split('.').length - 1];
                                if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
                                    resolve(results[0].get('file'));
                                } else {//解析数据base64
                                    var data = results[0].get('file');
                                    var buffer = new Buffer(data, 'base64');
                                    resolve(buffer.toString());
                                }
                            });
                        } else {
                            //如果没有数据，则创建
                            gh.save().then(function () {
                                var ext = path.split('.')[path.split('.').length - 1];
                                if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
                                    resolve(data.content);
                                } else {//解析数据base64
                                    var date = data.content;
                                    var buffer = new Buffer(date, 'base64');
                                    resolve(buffer.toString());
                                }
                            });
                        }
                    });
                } else {
                    //获取失败
                    reject('It\'s not a file');
                }
            });
            res.on("error", function (err) {
                reject(err);
            });
        });
    })
}

//获取lc上的文件如果没有则使用getGithubData(owner, repo, branch, path)
function getLcData(owner, repo, branch, path) {
    return new Promise(function (resolve, reject) {
        //获取lc上的数据
        var query = new AV.Query('gh');
        query.equalTo('owner', owner);
        query.equalTo('repo', repo);
        query.equalTo('branch', branch);
        query.equalTo('path', path);
        query.find().then(function (results) {
            if (results.length > 0) {
                //时间戳和现在时间戳比较大6小时，则重新获取getGithubData(owner, repo, branch, path)
                var time = results[0].get('time');
                var now = new Date().getTime();
                if (now - time > 6 * 60 * 60 * 1000) {
                    getGithubData(owner, repo, branch, path).then(function (data) {
                        resolve(data);
                    }).catch(function (e) {
                        reject(e);
                    });
                } else {
                    var ext = path.split('.')[path.split('.').length - 1];
                    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
                        resolve(results[0].get('file'));
                    } else {//解析数据base64
                        var data = results[0].get('file');
                        var buffer = new Buffer(data, 'base64');
                        resolve(buffer.toString());
                    }
                }
            } else {
                //如果没有数据，则创建
                //获取github的数据
                getGithubData(owner, repo, branch, path).then(function (data) {
                    resolve(data);
                }).catch(function (e) {
                    reject(e);
                });
            }
        });
    });
}

function getNpmData(packager, file) {
    //获取github的数据
    return new Promise(function (resolve, reject) {
        //获取github的数据
        //在promise中使用https请求
        var option = {
            hostname: 'unpkg.com', path: '/' + packager + '/' + file, headers: {
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
                'Accept-Encoding': 'utf-8',  //这里设置返回的编码方式 设置其他的会是乱码
                'Accept-Language': 'zh-CN,zh;q=0.8',
                'Connection': 'keep-alive'

            }
        };
        https.get(option, function (res) {
            //返回的数据
            let body = "";
            //每次读取数据
            res.on("data", function (chunk) {
                body += chunk;
            });
            //读取完毕
            res.on("end", function () {
                resolve(body);
            });
        }).on('error', function (e) {
            reject(e);
        });
    });
}

//路由
http.createServer(function (req, res) {
    req.url=nodeurl.parse(req.url).pathname
    console.log(req.url);
    //路由的路径是/gh/:owner/:repo@:branch/:path
    if (req.url.indexOf('/gh/') === 0) {
        var url = req.url.split('/gh/')[1];
        if (url) {
            var urlArr = url.split('/');
            if (urlArr.length >= 3) {
                //获取owner，repo，branch，path
                var owner = urlArr[0], repoandbranch = urlArr[1]
                var repo = repoandbranch.split('@')[0];
                if (repoandbranch.split('@').length > 1) {
                    var branch = repoandbranch.split('@')[1];
                } else {
                    var branch = 'master';
                }
                var path = urlArr.slice(2).join('/');//末尾的如果是/，则去掉
                //获取lc上的数据
                getLcData(owner, repo, branch, path).then(function (data) {
                    //判断是否是图片
                    if (path.split('.').length > 1) {
                        var ext = path.split('.')[path.split('.').length - 1];
                        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
                            res.writeHead(301, {'Location': 'https://raw.githubusercontent.com/'+owner+'/'+repo+'/'+branch+'/'+path});
                            res.end()
                        } else if (ext === 'css') {
                            res.writeHead(200, {
                                'Content-Type': 'text/css'
                            });
                            res.write(data);
                            res.end();
                        } else if (ext === 'js') {
                            res.writeHead(200, {
                                'Content-Type': 'text/javascript;charset=utf-8'
                            });
                            res.write(data);
                            res.end();
                        } else {
                            res.writeHead(200, {
                                'Content-Type': 'text/html;charset=utf-8'
                            });
                            res.write(data);
                            res.end();
                        }
                    } else {
                        res.writeHead(200, {
                            'Content-Type': 'text/plain;charset=utf-8'
                        });
                        res.write(data);
                        res.end();
                    }
                }).catch(function (e) {
                    res.writeHead(404, {
                        'Content-Type': 'text/html;charset=utf-8'
                    });
                    res.write(e.toString());
                    res.end();
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
    } else if (req.url.indexOf('/api/') === 0) {
        //路由的路径是/api/:owner/:repo@:branch/:path
        var url = req.url.split('/api/')[1];
        if (url) {
            var urlArr = url.split('/');
            if (urlArr.length >= 3) {
                //获取owner，repo，branch，path
                var owner = urlArr[0], repoandbranch = urlArr[1]
                var repo = repoandbranch.split('@')[0];
                if (repoandbranch.split('@').length > 1) {
                    var branch = repoandbranch.split('@')[1];
                } else {
                    var branch = 'master';
                }
                var path = urlArr.slice(2).join('/');//末尾的如果是/，则去掉
                //获取github的数据
                getGithubData(owner, repo, branch, path).then(function (data) {
                    res.writeHead(200, {
                        'Content-Type': 'text/html;charset=utf-8'
                    });
                    res.write('success');
                    res.end();
                }).catch(function (e) {
                    res.writeHead(404, {
                        'Content-Type': 'text/html;charset=utf-8'
                    });
                    res.write(e);
                    res.end();
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
    } else if (req.url.indexOf('/npm/') === 0) {
        //路由的路径是/npm/:package@:version/:file
        var url = req.url.split('/npm/')[1];
        if (url) {
            var urlArr = url.split('/');
            if (urlArr.length >= 2) {
                //获取package，version，file
                var package = urlArr[0];
                var file = urlArr.slice(1).join('/');//末尾的如果是/，则去掉
                //获取npm的数据
                getNpmData(package,file).then(function (data) {
                    res.writeHead(200, {
                        'Content-Type': 'text/plain;charset=utf-8'
                    });
                    res.write(data);
                    res.end();
                }).catch(function (e) {
                    res.writeHead(404, {
                        'Content-Type': 'text/html;charset=utf-8'
                    });
                    res.write(e);
                    res.end();
                });
            } else {
                //输出网页
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.write('url mest be:/npm/:package@:version/:file');
                res.end();
            }
        } else {
            //输出网页
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.write('url mest be:/npm/:package@:version/:file');
            res.end();
        }
    } else {
        //输出网页
        if (req.url === '/') {
            //读取静态文件index.html
            fs.readFile('../index.html', function (err, data) {
                if (err) {
                    res.writeHead(404, {'Content-Type': 'text/html;charset=utf-8'});
                    res.write('Where is index.html?');
                    res.end();
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'text/html;charset=utf-8'
                    });
                    res.write(data);
                    res.end();
                }
            });
        } else {
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.write('url mest be:/ or /gh/:owner/:repo@:branch/:path or /api/:owner/:repo@:branch/:path or /npm/:package@:version/:file');
            res.end();
        }
    }
}).listen(80);
