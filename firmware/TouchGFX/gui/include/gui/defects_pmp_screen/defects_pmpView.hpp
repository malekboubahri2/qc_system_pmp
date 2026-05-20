#ifndef DEFECTS_PMPVIEW_HPP
#define DEFECTS_PMPVIEW_HPP

#include <gui_generated/defects_pmp_screen/defects_pmpViewBase.hpp>
#include <gui/defects_pmp_screen/defects_pmpPresenter.hpp>

class defects_pmpView : public defects_pmpViewBase
{
public:
    defects_pmpView();
    virtual ~defects_pmpView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();
protected:
};

#endif // DEFECTS_PMPVIEW_HPP
