#ifndef INPUT_TYPEVIEW_HPP
#define INPUT_TYPEVIEW_HPP

#include <gui_generated/input_type_screen/input_typeViewBase.hpp>
#include <gui/input_type_screen/input_typePresenter.hpp>

class input_typeView : public input_typeViewBase
{
public:
    input_typeView();
    virtual ~input_typeView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();
protected:
};

#endif // INPUT_TYPEVIEW_HPP
