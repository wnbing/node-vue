var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var path = require('path');
var config = require("config-lite")(__dirname);
var fs = require("fs");
var formidable = require('formidable');
const ModelUser = require('../models/user')
const checkLogin = require('../middlewares/check').checkLogin
var slide = require('../public/javascripts/slide.js');

/*注册 */
router.post('/signup', function(req, res, next) { //注册用户接口
    var md5 = crypto.createHash('md5');
    var form = new formidable.IncomingForm();
    form.uploadDir = "./public/images";
    form.parse(req, function(err, fields, files) {
        var password = fields.password;
        password = md5.update(password).digest('base64');
        var name = fields.name;
        var gender = fields.gender;
        var genderJson = { "男": "m", "女": "f", "保密": "x" };
        gender = genderJson[gender];
        var avatar = files.avatar.path.split(path.sep).pop();
        var description = fields.description;

        var oldpath = files.avatar.path;
        var extname = files.avatar.name;
        var newpath = "./public/images/" + extname;
        //改名和存储
        fs.rename(oldpath, newpath, function(err) {
            avatar = newpath.replace("./public", "http://" + config.url);
            var user = {
                name: name,
                password: password,
                gender: gender,
                avatar: avatar,
                description: description
            };
            try {
                ModelUser.create(user).then(function(result) {
                    res.send({ state: 1, msg: "成功" });
                }).catch(function(e) {
                    fs.unlink(newpath);
                    // 用户名被占用则跳回注册页，而不是错误页
                    if (e.message.match('duplicate key')) {
                        res.send({ state: -2, msg: "用户名已经被占用" });
                    } else {
                        res.send({ state: -1, msg: e.message });
                    }
                })
            } catch (ex) {
                res.send({ state: -1, msg: ex.message });
            }
        })
    })


    /*var user = req.body.user;
    var password = md5.update(req.body.user.password).digest('base64');
    user.password = password;*/


});


/*登录 */
router.get("/gt/register-slide", function(req, res) {

    // 向极验申请每次验证所需的challenge
    slide.register(null, function(err, data) {
        if (err) {
            console.error(err);
            res.status(500);
            res.send(err);
            return;
        }

        if (!data.success) {
            req.session.fallback = true;
            res.send(data);
        } else {
            req.session.fallback = false;
            res.send(data);
        }
    });
});

router.post("/login", function(req, res, next) {
    var username = req.body.name;
    var password = req.body.password;
    // 对ajax提供的验证凭证进行二次验证
    slide.validate(req.session.fallback, {
        geetest_challenge: req.body.geetest_challenge,
        geetest_validate: req.body.geetest_validate,
        geetest_seccode: req.body.geetest_seccode
    }, function(err, success) {

        if (err) {
            // 网络错误
            res.send({
                state: -1,
                msg: err
            });

        } else if (!success) {

            // 二次验证失败
            res.send({
                state: -2,
                msg: '登录失败'
            });
        } else {
            var md5 = crypto.createHash('md5');
            var password = md5.update(req.body.password).digest('base64');
            ModelUser.getUserByName(req.body.name).then(function(result) {
                if (result.password) {
                    if (result.password == password) {
                        req.session.user = result;
                        res.send({ state: 1, msg: "成功", data: result })
                    } else {
                        res.send({ state: -3, msg: "用户名或密码错误" })
                    }
                } else {
                    res.send({ state: -3, msg: "用户名或密码错误" })
                }

            }).catch(function(ex) {
                res.send({ state: -4, msg: ex.message })
            })


        }
    });
})

//#region  退出的接口
router.post("/logout", function(req, res, next) {
        req.session.user = null;
        res.send({ state: 1, msg: "成功" })
    })
    //#endregion

//#region 通过id来修改用户的密码
router.post("/updatePassword", checkLogin, function(req, res, next) {
        var id = req.body.id;
        var password = req.body.password;
        var md5 = crypto.createHash('md5');
        password = md5.update(password).digest('base64');
        password =
            ModelUser.updatePassword(id, password).then(function(result) {
                if (result.result.ok == 1) {
                    res.send({ state: 1, msg: "成功" })
                } else {
                    res.send({ state: -2, msg: "失败" })
                }

            }).catch(function(ex) {
                res.send({ state: -4, msg: ex.message })
            })
    })
    //#endregion

//#region 
//#endregion

//#region 
//#endregion

module.exports = router;