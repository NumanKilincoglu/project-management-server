import jwt from 'jsonwebtoken';

function setJWTCookie(res, key, value, options) {
    res.cookie(key, value, options);
}

async function checkToken(req, res) {

    const token = req.cookies.token

    if (!token) {
        return res.status(401).send({
            status: 'OK',
            success: false,
            message: 'Token Not Found!'
        });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({
                    status: 'OK',
                    success: false,
                    message: 'Token Expired!'
                });
            }
            return res.status(403).json({
                status: 'OK',
                success: false,
                message: 'Authorization Error!'
            });
        }
        return res.status(200).json({
            status: 'OK',
            success: true,
            message: 'Token is valid!'
        });
    });
}

const AuthUtil = {
    setJWTCookie,
    checkToken
}

export default AuthUtil;




