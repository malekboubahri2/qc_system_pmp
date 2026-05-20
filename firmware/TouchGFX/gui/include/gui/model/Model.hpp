#ifndef MODEL_HPP
#define MODEL_HPP

class ModelListener;

class Model
{
public:
    /* Maximum PIN digits the login screen supports (4 circles in the Designer). */
    static const int PIN_MAX_LEN    = 4;
    static const int OPERATOR_COUNT = 3;

    struct operator_entry_t {
        int  id;
        char name[32];
        /* Plaintext for PoC. Replace body of validatePin() with
         * pin_hash_verify() once Application/domain/pin_hash.h exists. */
        char pin[PIN_MAX_LEN + 1];
    };

    Model();

    void bind(ModelListener* listener)
    {
        modelListener = listener;
    }

    void tick();

    /* Returns true and sets *out_idx if pin matches any operator. */
    bool validatePin(const char* pin, int* out_idx) const;

    const operator_entry_t& getOperator(int idx) const;

protected:
    ModelListener* modelListener;

private:
    static const operator_entry_t s_operators[OPERATOR_COUNT];
};

#endif // MODEL_HPP
