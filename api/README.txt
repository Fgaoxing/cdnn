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
        https.get({option}, function (res) {
            //返回的数据
            let data = "";
            //每次读取数据
            res.on("data", function (chunk) {
                data += chunk;
            });
            //读取完毕
            res.on("end", function () {
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
                                let buffer = new Buffer(data.content, 'base64').toString();
                                resolve(buffer);
                            });
                        } else {
                            //如果没有数据，则创建
                            gh.save().then(function () {
                                let buffer = new Buffer(data.content, 'base64').toString();
                                resolve(buffer);
                            });
                        }
                    });
                } else {
                    //获取失败
                    reject('It\'s not a file');
                }
            });
        }).on('error', function (e) {
            console.log("Got error: " + e);
            reject(e);
        });