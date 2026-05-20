#ifndef SUMMARYVIEW_HPP
#define SUMMARYVIEW_HPP

#include <gui_generated/summary_screen/summaryViewBase.hpp>
#include <gui/summary_screen/summaryPresenter.hpp>

class summaryView : public summaryViewBase
{
public:
    summaryView();
    virtual ~summaryView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();
protected:
};

#endif // SUMMARYVIEW_HPP
