import Joi from "joi";

const walletCreate = {
  body: Joi.object().keys({
    coin_type: Joi.string().required(),
    network: Joi.number().required(),
  }),
};

export default {
    walletCreate
}