#ifndef DEFECTS_INJVIEW_HPP
#define DEFECTS_INJVIEW_HPP

#include <gui_generated/defects_inj_screen/defects_injViewBase.hpp>
#include <gui/defects_inj_screen/defects_injPresenter.hpp>

class defects_injView : public defects_injViewBase
{
public:
    defects_injView();
    virtual ~defects_injView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();
protected:
};

#endif // DEFECTS_INJVIEW_HPP
