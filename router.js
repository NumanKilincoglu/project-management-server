import routes from "./routes/routes.js";

const router = (app) => {
  app.use(
    "/",
    routes
  );
};

 function baseResponse(req, res) {
    console.log(req.path)
    return res.status(400).send({ success: false, message: 'Method not found.' });
}

export default router;
