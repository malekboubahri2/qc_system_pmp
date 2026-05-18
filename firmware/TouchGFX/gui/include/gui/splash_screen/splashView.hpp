#ifndef SPLASHVIEW_HPP
#define SPLASHVIEW_HPP

#include <gui_generated/splash_screen/splashViewBase.hpp>
#include <gui/splash_screen/splashPresenter.hpp>

class splashView : public splashViewBase
{
public:
    splashView();
    virtual ~splashView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();
protected:
};

#endif // SPLASHVIEW_HPP
