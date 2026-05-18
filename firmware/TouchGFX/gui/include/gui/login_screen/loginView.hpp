#ifndef LOGINVIEW_HPP
#define LOGINVIEW_HPP

#include <gui_generated/login_screen/loginViewBase.hpp>
#include <gui/login_screen/loginPresenter.hpp>

class loginView : public loginViewBase
{
public:
    loginView();
    virtual ~loginView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();
protected:
};

#endif // LOGINVIEW_HPP
