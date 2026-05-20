#ifndef MODEL_HPP
#define MODEL_HPP

#include <stddef.h>

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

    /* Which defect screen opened the keyboard for Préciser input. */
    enum class PreciserOrigin {
        NONE,
        PMP_DEFECTS,
        INJ_DEFECTS
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

    /* Préciser round-trip state — set before navigating to keyboard,
     * consumed in the returning defect screen's activate(). */
    void setPreciserOrigin(PreciserOrigin origin) { m_preciserOrigin = origin; }
    PreciserOrigin getPreciserOrigin() const { return m_preciserOrigin; }

    void setPreciserPendingText(const char* text);
    const char* getPreciserPendingText() const { return m_preciserBuffer; }

    void clearPreciser();

protected:
    ModelListener* modelListener;

private:
    static const operator_entry_t s_operators[OPERATOR_COUNT];

    static const size_t PRECISER_BUFFER_SIZE = 128;
    PreciserOrigin m_preciserOrigin;
    char m_preciserBuffer[PRECISER_BUFFER_SIZE];
};

#endif // MODEL_HPP
