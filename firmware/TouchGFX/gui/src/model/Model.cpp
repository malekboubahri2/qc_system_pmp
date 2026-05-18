#include <gui/model/Model.hpp>
#include <gui/model/ModelListener.hpp>
#include <string.h>

const Model::operator_entry_t Model::s_operators[Model::OPERATOR_COUNT] = {
    { 1, "Mohammed Benali", "1234" },
    { 2, "Karim Trabelsi",  "5678" },
    { 3, "Youssef Chabbi",  "9876" },
};

Model::Model() : modelListener(0)
{
}

void Model::tick()
{
}

bool Model::validatePin(const char* pin, int* out_idx) const
{
    for (int i = 0; i < OPERATOR_COUNT; ++i)
    {
        if (strcmp(pin, s_operators[i].pin) == 0)
        {
            if (out_idx)
                *out_idx = i;
            return true;
        }
    }
    return false;
}

const Model::operator_entry_t& Model::getOperator(int idx) const
{
    return s_operators[idx];
}
